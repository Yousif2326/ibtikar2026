"""
FastAPI Clinical Trial Matching API
====================================
Endpoints:
  POST /ocr       — Upload image → Tesseract OCR → extracted text (ephemeral)
  POST /match     — OCR text → GPT-4o extraction → vector search → GPT-4o re-rank
  POST /search    — Direct vector search (condition + patient criteria)
  GET  /health    — Liveness probe

Security:
  - WorkOS Bearer token auth on all non-public routes
  - Rate limiting per user
  - Secure headers (HSTS, CSP, X-Frame-Options, etc.)
  - CORS locked to frontend origin
  - All PHI processed in-memory only (ephemeral)
  - Audit logging (no PHI in logs)
"""

from __future__ import annotations

import gc
import io
import os
from contextlib import asynccontextmanager
from typing import Any, Optional

import chromadb
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from PIL import Image
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

import pytesseract

from audit import log_event
from auth import AuthMiddleware, get_user_id_from_request
from config import (
    ALLOWED_IMAGE_TYPES,
    ALLOWED_ORIGINS,
    CHROMA_PATH,
    COLLECTION_NAME,
    EMBEDDING_MODEL,
    MAX_UPLOAD_SIZE_BYTES,
    OPENAI_API_KEY,
    RATE_LIMIT_MATCH,
    RATE_LIMIT_OCR,
    RATE_LIMIT_SEARCH,
)
from security import SecurityHeadersMiddleware

# ---------------------------------------------------------------------------
# Rate limiter (keyed by user from auth)
# ---------------------------------------------------------------------------


def _get_user_key(request: Request) -> str:
    """Rate-limit key: use authenticated user ID, fall back to IP."""
    uid = getattr(request.state, "user_id", None)
    return uid or get_remote_address(request)


limiter = Limiter(key_func=_get_user_key)

# ---------------------------------------------------------------------------
# Lazy singletons
# ---------------------------------------------------------------------------
_model: SentenceTransformer | None = None
_collection: Any = None
_openai_client: OpenAI | None = None
RRF_K = 60


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(EMBEDDING_MODEL)
    return _model


def get_collection() -> Any:
    global _collection
    if _collection is None:
        client = chromadb.PersistentClient(path=CHROMA_PATH)
        _collection = client.get_collection(COLLECTION_NAME)
    return _collection


def get_openai() -> OpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = OpenAI(api_key=OPENAI_API_KEY)
    return _openai_client


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: validate that ChromaDB exists
    if not os.path.isdir(CHROMA_PATH):
        import warnings
        warnings.warn(
            f"ChromaDB not found at {CHROMA_PATH}. "
            "Run: python ingest_clinical_trials_to_chromadb.py"
        )
    yield
    # Shutdown: nothing special


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Clinical Trials Matching API",
    description="HIPAA-compliant clinical trial matching with OCR and RAG",
    lifespan=lifespan,
)

# --- Middleware (order matters: last added = first executed) ----------------
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(AuthMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=[],
    max_age=600,
)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class OCRResponse(BaseModel):
    extracted_text: str
    confidence_note: str = ""


class MatchRequest(BaseModel):
    ocr_text: str = Field(..., min_length=1, max_length=50000)
    n_results: int = Field(default=10, ge=1, le=30)


class TrialMatch(BaseModel):
    id: str
    study_title: str
    study_url: str
    study_status: str
    phases: str
    conditions: str
    brief_summary: str
    interventions: str
    sponsor: str
    collaborators: str
    score: Optional[float] = None
    match_reasoning: str = ""


class MatchResponse(BaseModel):
    patient_criteria: dict
    results: list[TrialMatch]


class SearchRequest(BaseModel):
    condition: Optional[str] = None
    patient_criteria: Optional[str] = None
    n_results: int = Field(default=10, ge=1, le=50)
    use_two_signals: bool = False


class TrialResult(BaseModel):
    id: str
    study_title: str
    study_url: str
    study_status: str
    phases: str
    conditions: str
    brief_summary: str
    interventions: str
    sponsor: str
    collaborators: str
    score: Optional[float] = None


class SearchResponse(BaseModel):
    query: str
    results: list[TrialResult]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def metadata_get(meta: dict, key: str, default: str = "") -> str:
    if not meta:
        return default
    v = meta.get(key)
    return (str(v).strip() if v is not None and str(v).strip() else "") or default


def _query_chroma(
    coll: Any,
    model: Any,
    query_text: str,
    n_results: int,
) -> tuple[list[str], list[dict], list[str], list[Optional[float]]]:
    query_embedding = model.encode([query_text]).tolist()
    raw = coll.query(
        query_embeddings=query_embedding,
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
    )
    ids = raw["ids"][0]
    metadatas = raw["metadatas"][0] or []
    documents = raw["documents"][0] or []
    distances = (
        (raw.get("distances") or [None])[0]
        if raw.get("distances")
        else [None] * len(ids)
    )
    return ids, metadatas, documents, distances


def _raw_to_trial_results(
    ids: list[str],
    metadatas: list[dict],
    documents: list[str],
    distances: list[Optional[float]],
) -> list[TrialResult]:
    results = []
    for i in range(len(ids)):
        meta = metadatas[i] if i < len(metadatas) else {}
        doc = documents[i] if i < len(documents) else ""
        dist = distances[i] if i < len(distances) else None
        score = float(dist) if dist is not None else None
        study_title = metadata_get(meta, "Study Title", "")
        if not study_title and doc:
            study_title = doc.split("\n")[0].strip() or ids[i]
        results.append(
            TrialResult(
                id=metadata_get(meta, "ID", ids[i]),
                study_title=study_title,
                study_url=metadata_get(meta, "Study URL"),
                study_status=metadata_get(meta, "Study Status"),
                phases=metadata_get(meta, "Phases"),
                conditions=metadata_get(meta, "Conditions"),
                brief_summary=(doc[:1500] + "..." if len(doc) > 1500 else doc),
                interventions=metadata_get(meta, "Interventions"),
                sponsor=metadata_get(meta, "Sponsor"),
                collaborators=metadata_get(meta, "Collaborators"),
                score=score,
            )
        )
    return results


def _reciprocal_rank_fusion(
    ranked_id_lists: list[list[str]],
    k: int = RRF_K,
) -> list[tuple[str, float]]:
    scores: dict[str, float] = {}
    for ids in ranked_id_lists:
        for rank, id_ in enumerate(ids):
            scores[id_] = scores.get(id_, 0.0) + 1.0 / (k + rank + 1)
    return sorted(scores.items(), key=lambda x: -x[1])


# ---------------------------------------------------------------------------
# POST /ocr — Tesseract OCR (ephemeral, in-memory only)
# ---------------------------------------------------------------------------


@app.post("/ocr", response_model=OCRResponse)
@limiter.limit(RATE_LIMIT_OCR)
async def ocr_endpoint(request: Request, file: UploadFile = File(...)):
    """
    Accept an image upload, run Tesseract OCR in-memory, return extracted text.
    No image data is written to disk or persisted in any way.
    """
    user_id = get_user_id_from_request(request)

    # --- Validate file type ---
    content_type = file.content_type or ""
    if content_type not in ALLOWED_IMAGE_TYPES:
        log_event(
            user_id=user_id,
            action="ocr_rejected",
            detail=f"invalid content type: {content_type}",
        )
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type}. "
            f"Allowed: {', '.join(sorted(ALLOWED_IMAGE_TYPES))}",
        )

    # --- Read into memory (ephemeral) ---
    image_bytes: bytes = await file.read()

    if len(image_bytes) > MAX_UPLOAD_SIZE_BYTES:
        # Immediately discard
        del image_bytes
        gc.collect()
        log_event(
            user_id=user_id,
            action="ocr_rejected",
            detail="file too large",
        )
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {MAX_UPLOAD_SIZE_BYTES // (1024*1024)} MB",
        )

    try:
        # --- OCR in-memory ---
        image = Image.open(io.BytesIO(image_bytes))
        extracted_text: str = pytesseract.image_to_string(image)

        log_event(
            user_id=user_id,
            action="ocr_success",
            detail=f"extracted {len(extracted_text)} chars from {len(image_bytes)} bytes",
        )

        return OCRResponse(
            extracted_text=extracted_text.strip(),
            confidence_note="OCR processed via Tesseract. Please review the extracted text for accuracy.",
        )
    except Exception as exc:
        log_event(
            user_id=user_id,
            action="ocr_error",
            detail="processing failed",
        )
        raise HTTPException(status_code=500, detail="OCR processing failed")
    finally:
        # --- HIPAA: aggressively discard all PHI from memory ---
        del image_bytes
        gc.collect()


# ---------------------------------------------------------------------------
# POST /match — Full RAG pipeline
# ---------------------------------------------------------------------------

_EXTRACT_SYSTEM_PROMPT = """You are a clinical data extraction assistant. Given OCR-extracted text from a patient document, extract structured patient information relevant to clinical trial matching.

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
Return ONLY valid JSON, no markdown fences or explanation."""

_RERANK_SYSTEM_PROMPT = """You are a clinical trial matching specialist. Given a patient's clinical profile and a list of candidate clinical trials, evaluate each trial for relevance.

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

Return ONLY valid JSON, no markdown fences or explanation."""


@app.post("/match", response_model=MatchResponse)
@limiter.limit(RATE_LIMIT_MATCH)
async def match_endpoint(request: Request, body: MatchRequest):
    """
    Full RAG pipeline:
    1. GPT-4o extracts structured patient criteria from OCR text
    2. Vector search finds candidate trials in ChromaDB
    3. GPT-4o re-ranks and explains matches
    """
    user_id = get_user_id_from_request(request)
    ocr_text = body.ocr_text
    n_results = body.n_results

    client = get_openai()
    model = get_model()
    coll = get_collection()

    try:
        # --- Step 1: Extract structured criteria with GPT-4o ---
        extract_response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": _EXTRACT_SYSTEM_PROMPT},
                {"role": "user", "content": ocr_text},
            ],
            temperature=0.1,
            max_tokens=1000,
            response_format={"type": "json_object"},
        )

        import json
        patient_criteria: dict = json.loads(
            extract_response.choices[0].message.content or "{}"
        )

        # --- Step 2: Build search query from extracted criteria ---
        search_parts = []
        if patient_criteria.get("conditions"):
            search_parts.append(
                "Conditions: " + ", ".join(patient_criteria["conditions"])
            )
        if patient_criteria.get("medications"):
            search_parts.append(
                "Medications: " + ", ".join(patient_criteria["medications"])
            )
        if patient_criteria.get("medical_history"):
            search_parts.append(
                "History: " + ", ".join(patient_criteria["medical_history"])
            )
        if patient_criteria.get("notes"):
            search_parts.append(patient_criteria["notes"])

        search_query = " | ".join(search_parts) if search_parts else ocr_text[:500]

        # Use two-signal search if we have distinct condition and criteria info
        condition_query = ""
        criteria_query = ""
        if patient_criteria.get("conditions"):
            condition_query = ", ".join(patient_criteria["conditions"])
        if search_parts:
            criteria_query = " ".join(search_parts)

        # Fetch more candidates for re-ranking
        fetch_n = min(n_results * 3, 50)

        if condition_query and criteria_query:
            # Two-signal with RRF
            ids1, meta1, doc1, dist1 = _query_chroma(
                coll, model, condition_query, fetch_n
            )
            ids2, meta2, doc2, dist2 = _query_chroma(
                coll, model, criteria_query, fetch_n
            )
            merged = _reciprocal_rank_fusion([ids1, ids2])[:fetch_n]
            top_ids = [id_ for id_, _ in merged]

            got = coll.get(ids=top_ids, include=["metadatas", "documents"])
            got_ids = got["ids"]
            got_metas = got.get("metadatas") or [{}] * len(got_ids)
            got_docs = got.get("documents") or [""] * len(got_ids)
        else:
            # Single query
            got_ids, got_metas, got_docs, _ = _query_chroma(
                coll, model, search_query, fetch_n
            )

        # --- Step 3: Re-rank with GPT-4o ---
        trials_for_rerank = []
        for i, trial_id in enumerate(got_ids):
            meta = got_metas[i] if i < len(got_metas) else {}
            doc = got_docs[i] if i < len(got_docs) else ""
            trials_for_rerank.append(
                {
                    "trial_id": trial_id,
                    "title": metadata_get(meta, "Study Title"),
                    "conditions": metadata_get(meta, "Conditions"),
                    "interventions": metadata_get(meta, "Interventions"),
                    "phases": metadata_get(meta, "Phases"),
                    "status": metadata_get(meta, "Study Status"),
                    "summary": (doc[:800] + "..." if len(doc) > 800 else doc),
                }
            )

        rerank_prompt = (
            f"Patient profile:\n{json.dumps(patient_criteria, indent=2)}\n\n"
            f"Candidate trials:\n{json.dumps(trials_for_rerank, indent=2)}"
        )

        rerank_response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": _RERANK_SYSTEM_PROMPT},
                {"role": "user", "content": rerank_prompt},
            ],
            temperature=0.2,
            max_tokens=4000,
            response_format={"type": "json_object"},
        )

        rerank_raw = json.loads(
            rerank_response.choices[0].message.content or '{"results":[]}'
        )
        # Handle both {"results": [...]} and direct [...]
        rerank_list = (
            rerank_raw if isinstance(rerank_raw, list)
            else rerank_raw.get("results", rerank_raw.get("trials", []))
        )

        # Build a lookup of rerank scores/reasoning by trial_id
        rerank_lookup: dict[str, dict] = {}
        for item in rerank_list:
            tid = item.get("trial_id", "")
            rerank_lookup[tid] = {
                "score": item.get("match_score", 0),
                "reasoning": item.get("match_reasoning", ""),
            }

        # --- Build final results ---
        meta_lookup = {got_ids[i]: got_metas[i] for i in range(len(got_ids))}
        doc_lookup = {got_ids[i]: got_docs[i] for i in range(len(got_ids))}

        # Sort by rerank score
        sorted_ids = sorted(
            got_ids,
            key=lambda tid: rerank_lookup.get(tid, {}).get("score", 0),
            reverse=True,
        )[:n_results]

        results: list[TrialMatch] = []
        for tid in sorted_ids:
            meta = meta_lookup.get(tid, {})
            doc = doc_lookup.get(tid, "")
            rr = rerank_lookup.get(tid, {})
            study_title = metadata_get(meta, "Study Title", "")
            if not study_title and doc:
                study_title = doc.split("\n")[0].strip() or tid

            results.append(
                TrialMatch(
                    id=metadata_get(meta, "ID", tid),
                    study_title=study_title,
                    study_url=metadata_get(meta, "Study URL"),
                    study_status=metadata_get(meta, "Study Status"),
                    phases=metadata_get(meta, "Phases"),
                    conditions=metadata_get(meta, "Conditions"),
                    brief_summary=(doc[:1500] + "..." if len(doc) > 1500 else doc),
                    interventions=metadata_get(meta, "Interventions"),
                    sponsor=metadata_get(meta, "Sponsor"),
                    collaborators=metadata_get(meta, "Collaborators"),
                    score=rr.get("score"),
                    match_reasoning=rr.get("reasoning", ""),
                )
            )

        log_event(
            user_id=user_id,
            action="match_success",
            detail=f"returned {len(results)} matched trials",
            metadata={"n_candidates": len(got_ids), "n_returned": len(results)},
        )

        return MatchResponse(patient_criteria=patient_criteria, results=results)

    except HTTPException:
        raise
    except Exception as exc:
        log_event(
            user_id=user_id,
            action="match_error",
            detail="pipeline failed",
        )
        raise HTTPException(status_code=500, detail="Trial matching failed")
    finally:
        # Ephemeral: discard OCR text from locals
        ocr_text = ""
        gc.collect()


# ---------------------------------------------------------------------------
# POST /search — Direct vector search (existing functionality)
# ---------------------------------------------------------------------------


@app.post("/search", response_model=SearchResponse)
@limiter.limit(RATE_LIMIT_SEARCH)
async def search(request: Request, req: SearchRequest):
    user_id = get_user_id_from_request(request)
    n_results = min(req.n_results, 50)
    model = get_model()
    coll = get_collection()

    use_two = (
        req.use_two_signals
        and (req.condition or "").strip()
        and (req.patient_criteria or "").strip()
    )

    if use_two:
        fetch_per_query = min(n_results * 2, 50)
        q_condition = (req.condition or "").strip() or "clinical trial"
        q_criteria = "Patient criteria: " + (req.patient_criteria or "").strip()

        ids1, meta1, doc1, dist1 = _query_chroma(
            coll, model, q_condition, fetch_per_query
        )
        ids2, meta2, doc2, dist2 = _query_chroma(
            coll, model, q_criteria, fetch_per_query
        )

        merged = _reciprocal_rank_fusion([ids1, ids2])[:n_results]
        top_ids = [id_ for id_, _ in merged]
        rrf_scores = {id_: score for id_, score in merged}

        got = coll.get(ids=top_ids, include=["metadatas", "documents"])
        got_ids = got["ids"]
        got_metas = got.get("metadatas") or [{}] * len(got_ids)
        got_docs = got.get("documents") or [""] * len(got_ids)
        results = _raw_to_trial_results(
            got_ids, got_metas, got_docs, [None] * len(got_ids)
        )
        for r in results:
            r.score = rrf_scores.get(r.id)

        query_text = f"[two-signal] condition: {q_condition} | criteria: {q_criteria}"

        log_event(
            user_id=user_id,
            action="search",
            detail=f"two-signal, {len(results)} results",
        )
        return SearchResponse(query=query_text, results=results)
    else:
        parts = []
        if req.condition and req.condition.strip():
            parts.append(req.condition.strip())
        if req.patient_criteria and req.patient_criteria.strip():
            parts.append("Patient criteria: " + req.patient_criteria.strip())
        query_text = " ".join(parts) if parts else "clinical trial"

        ids, metadatas, documents, distances = _query_chroma(
            coll, model, query_text, n_results
        )
        results = _raw_to_trial_results(ids, metadatas, documents, distances)

        log_event(
            user_id=user_id,
            action="search",
            detail=f"single-signal, {len(results)} results",
        )
        return SearchResponse(query=query_text, results=results)


# ---------------------------------------------------------------------------
# GET /health
# ---------------------------------------------------------------------------


@app.get("/health")
async def health():
    return {"status": "ok"}
