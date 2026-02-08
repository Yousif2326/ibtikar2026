/**
 * API client for communicating with the Next.js API routes.
 * All requests go through Next.js API routes (server-side)
 * so credentials and sensitive logic never touch the browser.
 *
 * - OCR: /api/ocr (OpenAI Vision GPT-4o)
 * - Search: /api/search (ChromaDB Cloud vector search + GPT-4o RAG pipeline)
 */

const API_BASE = '/api';

export interface OCRResponse {
  extracted_text: string;
  confidence_note: string;
}

export interface PatientCriteria {
  age: number | null;
  sex: string | null;
  conditions: string[];
  medications: string[];
  allergies: string[];
  lab_values: Record<string, string>;
  medical_history: string[];
  notes: string;
}

export interface TrialMatch {
  id: string;
  study_title: string;
  study_url: string;
  study_status: string;
  phases: string;
  conditions: string;
  brief_summary: string;
  interventions: string;
  sponsor: string;
  collaborators: string;
  score: number | null;
  match_reasoning: string;
}

export interface MatchResponse {
  patient_criteria: PatientCriteria;
  results: TrialMatch[];
}

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    let message = `Request failed (${res.status})`;
    try {
      const json = JSON.parse(body);
      message = json.detail || json.message || message;
    } catch {}
    throw new APIError(res.status, message);
  }
  return res.json();
}

/**
 * Upload an image for OCR processing.
 * The image is sent to the Next.js API route which uses OpenAI Vision.
 */
export async function uploadForOCR(file: File | Blob): Promise<OCRResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/ocr`, {
    method: 'POST',
    body: formData,
  });

  return handleResponse<OCRResponse>(res);
}

/**
 * Send OCR text for clinical trial matching via the RAG pipeline.
 * Calls /api/search which runs the full pipeline server-side:
 *   1. GPT-4o extracts patient criteria
 *   2. ChromaDB Cloud vector search
 *   3. GPT-4o re-ranks results
 */
export async function matchTrials(
  ocrText: string,
  nResults: number = 10
): Promise<MatchResponse> {
  const res = await fetch(`${API_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ocr_text: ocrText, n_results: nResults }),
  });

  return handleResponse<MatchResponse>(res);
}

export { APIError };
