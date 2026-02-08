/**
 * Next.js API route: /api/search
 *
 * Full RAG pipeline for clinical trial matching:
 *   1. GPT-4o extracts structured patient criteria from OCR text
 *   2. Vector search in ChromaDB Cloud (with optional two-signal RRF)
 *   3. GPT-4o re-ranks and explains matches
 *
 * Runs server-side only. ChromaDB Cloud credentials and OpenAI keys
 * never reach the browser.
 */

import { NextRequest, NextResponse } from "next/server";
import { CloudClient } from "chromadb";
import { OpenAIEmbeddingFunction } from "@chroma-core/openai";
import OpenAI from "openai";

// ---------------------------------------------------------------------------
// Configuration (all server-side env vars)
// ---------------------------------------------------------------------------
const CHROMA_API_KEY = process.env.CHROMA_API_KEY || "";
const CHROMA_TENANT = process.env.CHROMA_TENANT || "";
const CHROMA_DATABASE = process.env.CHROMA_DATABASE || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const COLLECTION_NAME = "clinical_trials";
const EMBEDDING_MODEL = "text-embedding-3-small";
const RRF_K = 60;
const MIN_MATCH_SCORE = 30; // Only return results with confidence above this threshold

// ---------------------------------------------------------------------------
// Lazy singletons
// ---------------------------------------------------------------------------
let _chromaClient: CloudClient | null = null;
let _embeddingFunction: OpenAIEmbeddingFunction | null = null;
let _openai: OpenAI | null = null;

function getChromaClient(): CloudClient {
  if (!_chromaClient) {
    _chromaClient = new CloudClient({
      tenant: CHROMA_TENANT,
      database: CHROMA_DATABASE,
      apiKey: CHROMA_API_KEY,
    });
  }
  return _chromaClient;
}

function getEmbeddingFunction(): OpenAIEmbeddingFunction {
  if (!_embeddingFunction) {
    _embeddingFunction = new OpenAIEmbeddingFunction({
      apiKey: OPENAI_API_KEY,
      modelName: EMBEDDING_MODEL,
    });
  }
  return _embeddingFunction;
}

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  }
  return _openai;
}

// ---------------------------------------------------------------------------
// GPT-4o prompts
// ---------------------------------------------------------------------------
const EXTRACT_SYSTEM_PROMPT = `You are a clinical data extraction assistant. Given OCR-extracted text from a patient document, extract structured patient information relevant to clinical trial matching.

Return a JSON object with ONLY these fields (use null for missing):
{
  "age": <number or null>,
  "sex": "<Male|Female|null>",
  "conditions": ["list of diagnosed conditions"],
  "medications": ["list of current medications"],
  "allergies": ["list of known allergies"],
  "lab_values": {"key": "value pairs of relevant lab results"},
  "medical_history": ["relevant medical history items"],
  "notes": "any other relevant clinical details"
}

Be precise. Only extract what is explicitly stated in the text. Do not infer or hallucinate.
Return ONLY valid JSON, no markdown fences or explanation.`;

const RERANK_SYSTEM_PROMPT = `You are a clinical trial matching specialist. Given a patient's clinical profile and a list of candidate clinical trials, evaluate each trial for relevance.

For each trial, provide:
1. A match_score from 0-100 (100 = perfect match)
2. A brief match_reasoning (1-2 sentences) explaining WHY this trial is or isn't a good match

Consider: patient conditions vs trial conditions, age/sex eligibility, intervention relevance, trial phase, and study status.

Return a JSON array sorted by match_score descending:
[
  {
    "trial_id": "NCT...",
    "match_score": 85,
    "match_reasoning": "Patient's Type 2 diabetes directly matches this Phase 3 trial studying a new GLP-1 receptor agonist. Age and sex are within eligible range."
  }
]

Return ONLY valid JSON, no markdown fences or explanation.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function metadataGet(
  meta: Record<string, unknown> | null | undefined,
  key: string,
  fallback = ""
): string {
  if (!meta) return fallback;
  const v = meta[key];
  if (v === null || v === undefined) return fallback;
  const s = String(v).trim();
  return s || fallback;
}

interface ChromaQueryResult {
  ids: string[][];
  documents: (string | null)[][] | null;
  metadatas: (Record<string, unknown> | null)[][] | null;
  distances: (number | null)[][] | null;
}

async function queryChroma(
  collection: Awaited<ReturnType<CloudClient["getCollection"]>>,
  queryText: string,
  nResults: number
): Promise<{
  ids: string[];
  metadatas: Record<string, unknown>[];
  documents: string[];
  distances: (number | null)[];
}> {
  const raw = (await collection.query({
    queryTexts: [queryText],
    nResults,
    include: ["documents", "metadatas", "distances"],
  })) as ChromaQueryResult;

  const ids = raw.ids[0] || [];
  const metadatas = (raw.metadatas?.[0] || []).map(
    (m) => m || ({} as Record<string, unknown>)
  );
  const documents = (raw.documents?.[0] || []).map((d) => d || "");
  const distances = raw.distances?.[0] || ids.map(() => null);

  return { ids, metadatas, documents, distances };
}

function reciprocalRankFusion(
  rankedIdLists: string[][],
  k: number = RRF_K
): Array<[string, number]> {
  const scores: Record<string, number> = {};
  for (const ids of rankedIdLists) {
    for (let rank = 0; rank < ids.length; rank++) {
      const id = ids[rank];
      scores[id] = (scores[id] || 0) + 1.0 / (k + rank + 1);
    }
  }
  return Object.entries(scores).sort((a, b) => b[1] - a[1]);
}

// ---------------------------------------------------------------------------
// POST /api/search
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ocrText: string = body.ocr_text || "";
    const nResults: number = Math.min(Math.max(body.n_results || 10, 1), 30);

    if (!ocrText || ocrText.trim().length === 0) {
      return NextResponse.json(
        { detail: "ocr_text is required and must be non-empty" },
        { status: 400 }
      );
    }

    const openai = getOpenAI();
    const chromaClient = getChromaClient();
    const embeddingFunction = getEmbeddingFunction();

    const collection = await chromaClient.getCollection({
      name: COLLECTION_NAME,
      embeddingFunction,
    });

    // --- Step 1: Extract structured criteria with GPT-4o ---
    const extractResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: EXTRACT_SYSTEM_PROMPT },
        { role: "user", content: ocrText },
      ],
      temperature: 0.1,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const patientCriteria = JSON.parse(
      extractResponse.choices[0].message.content || "{}"
    );

    // --- Step 2: Build search query from extracted criteria ---
    const searchParts: string[] = [];
    if (patientCriteria.conditions?.length) {
      searchParts.push("Conditions: " + patientCriteria.conditions.join(", "));
    }
    if (patientCriteria.medications?.length) {
      searchParts.push(
        "Medications: " + patientCriteria.medications.join(", ")
      );
    }
    if (patientCriteria.medical_history?.length) {
      searchParts.push(
        "History: " + patientCriteria.medical_history.join(", ")
      );
    }
    if (patientCriteria.notes) {
      searchParts.push(patientCriteria.notes);
    }

    const searchQuery = searchParts.length
      ? searchParts.join(" | ")
      : ocrText.slice(0, 500);

    // Two-signal search with RRF when both condition and criteria available
    const conditionQuery = patientCriteria.conditions?.length
      ? patientCriteria.conditions.join(", ")
      : "";
    const criteriaQuery = searchParts.length ? searchParts.join(" ") : "";

    const fetchN = Math.min(nResults * 3, 50);

    let gotIds: string[];
    let gotMetas: Record<string, unknown>[];
    let gotDocs: string[];

    if (conditionQuery && criteriaQuery) {
      // Two-signal with RRF
      const [result1, result2] = await Promise.all([
        queryChroma(collection, conditionQuery, fetchN),
        queryChroma(collection, criteriaQuery, fetchN),
      ]);

      const merged = reciprocalRankFusion([result1.ids, result2.ids]).slice(
        0,
        fetchN
      );
      const topIds = merged.map(([id]) => id);

      const got = await collection.get({
        ids: topIds,
        include: ["metadatas", "documents"],
      });

      gotIds = got.ids;
      gotMetas = (got.metadatas || []).map(
        (m) => m || ({} as Record<string, unknown>)
      );
      gotDocs = (got.documents || []).map((d) => d || "");
    } else {
      // Single query
      const result = await queryChroma(collection, searchQuery, fetchN);
      gotIds = result.ids;
      gotMetas = result.metadatas;
      gotDocs = result.documents;
    }

    // --- Step 3: Re-rank with GPT-4o ---
    const trialsForRerank = gotIds.map((id, i) => {
      const meta = gotMetas[i] || {};
      const doc = gotDocs[i] || "";
      return {
        trial_id: id,
        title: metadataGet(meta, "Study Title"),
        conditions: metadataGet(meta, "Conditions"),
        interventions: metadataGet(meta, "Interventions"),
        phases: metadataGet(meta, "Phases"),
        status: metadataGet(meta, "Study Status"),
        summary: doc.length > 800 ? doc.slice(0, 800) + "..." : doc,
      };
    });

    const rerankPrompt = `Patient profile:\n${JSON.stringify(patientCriteria, null, 2)}\n\nCandidate trials:\n${JSON.stringify(trialsForRerank, null, 2)}`;

    const rerankResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: RERANK_SYSTEM_PROMPT },
        { role: "user", content: rerankPrompt },
      ],
      temperature: 0.2,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const rerankRaw = JSON.parse(
      rerankResponse.choices[0].message.content || '{"results":[]}'
    );
    const rerankList: Array<{
      trial_id: string;
      match_score: number;
      match_reasoning: string;
    }> = Array.isArray(rerankRaw)
      ? rerankRaw
      : rerankRaw.results || rerankRaw.trials || [];

    // Build lookup of rerank scores/reasoning by trial_id
    const rerankLookup: Record<
      string,
      { score: number; reasoning: string }
    > = {};
    for (const item of rerankList) {
      rerankLookup[item.trial_id] = {
        score: item.match_score || 0,
        reasoning: item.match_reasoning || "",
      };
    }

    // Build lookup maps
    const metaLookup: Record<string, Record<string, unknown>> = {};
    const docLookup: Record<string, string> = {};
    for (let i = 0; i < gotIds.length; i++) {
      metaLookup[gotIds[i]] = gotMetas[i] || {};
      docLookup[gotIds[i]] = gotDocs[i] || "";
    }

    // Sort by rerank score, prefer results above threshold, but always return top nResults
    const sorted = [...gotIds].sort(
      (a, b) =>
        (rerankLookup[b]?.score || 0) - (rerankLookup[a]?.score || 0)
    );
    const aboveThreshold = sorted.filter(
      (tid) => (rerankLookup[tid]?.score || 0) > MIN_MATCH_SCORE
    );
    const sortedIds = aboveThreshold.length > 0
      ? aboveThreshold.slice(0, nResults)
      : sorted.slice(0, nResults);

    const results = sortedIds.map((tid) => {
      const meta = metaLookup[tid] || {};
      const doc = docLookup[tid] || "";
      const rr = rerankLookup[tid] || {};
      let studyTitle = metadataGet(meta, "Study Title");
      if (!studyTitle && doc) {
        studyTitle = doc.split("\n")[0].trim() || tid;
      }

      return {
        id: metadataGet(meta, "ID", tid),
        study_title: studyTitle,
        study_url: metadataGet(meta, "Study URL"),
        study_status: metadataGet(meta, "Study Status"),
        phases: metadataGet(meta, "Phases"),
        conditions: metadataGet(meta, "Conditions"),
        brief_summary: doc.length > 1500 ? doc.slice(0, 1500) + "..." : doc,
        interventions: metadataGet(meta, "Interventions"),
        sponsor: metadataGet(meta, "Sponsor"),
        collaborators: metadataGet(meta, "Collaborators"),
        score: rr.score ?? null,
        match_reasoning: rr.reasoning || "",
      };
    });

    return NextResponse.json({
      patient_criteria: patientCriteria,
      results,
    });
  } catch (error) {
    console.error("Search pipeline error:", error);
    return NextResponse.json(
      { detail: "Clinical trial search failed" },
      { status: 500 }
    );
  }
}
