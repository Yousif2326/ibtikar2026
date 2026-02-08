/**
 * API client for communicating with the backend.
 * All requests go through Next.js API routes (server-side proxy)
 * so the backend URL and auth tokens never touch the browser.
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
 * The image is sent to the Next.js API route which proxies to the backend.
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
 */
export async function matchTrials(
  ocrText: string,
  nResults: number = 10
): Promise<MatchResponse> {
  const res = await fetch(`${API_BASE}/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ocr_text: ocrText, n_results: nResults }),
  });

  return handleResponse<MatchResponse>(res);
}

export { APIError };
