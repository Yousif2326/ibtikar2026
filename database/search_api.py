"""
FastAPI server: query ChromaDB by condition + patient criteria.
Run: uvicorn search_api:app --reload --port 8000
"""

import os
from typing import Any, Optional

import chromadb
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer

CHROMA_PATH = os.path.join(os.path.dirname(__file__), "chroma_clinical_trials")
COLLECTION_NAME = "clinical_trials"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
RRF_K = 60  # reciprocal rank fusion constant

app = FastAPI(title="Clinical Trials Search API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lazy-loaded so server starts fast
_model = None
_collection = None


def get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer(EMBEDDING_MODEL)
    return _model


def get_collection():
    global _collection
    if _collection is None:
        client = chromadb.PersistentClient(path=CHROMA_PATH)
        _collection = client.get_collection(COLLECTION_NAME)
    return _collection


class SearchRequest(BaseModel):
    condition: Optional[str] = None
    patient_criteria: Optional[str] = None
    n_results: int = Field(default=10, ge=1, le=50)
    use_two_signals: bool = Field(
        default=False,
        description="If True, embed condition and patient_criteria separately, run two searches, merge with RRF.",
    )


class TrialResult(BaseModel):
    """Matches CTG merged CSV: no eligibilityCriteria, Inclusion, Exclusion columns."""
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
    """Run one vector search; return (ids, metadatas, documents, distances)."""
    query_embedding = model.encode([query_text]).tolist()
    raw = coll.query(
        query_embeddings=query_embedding,
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
    )
    ids = raw["ids"][0]
    metadatas = raw["metadatas"][0] or []
    documents = raw["documents"][0] or []
    distances = (raw.get("distances") or [None])[0] if raw.get("distances") else [None] * len(ids)
    return ids, metadatas, documents, distances


def _raw_to_trial_results(
    ids: list[str],
    metadatas: list[dict],
    documents: list[str],
    distances: list[Optional[float]],
) -> list[TrialResult]:
    """Build TrialResult list from Chroma query output."""
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
    """Merge multiple ranked id lists using RRF. Returns [(id, score), ...] sorted by score desc."""
    scores: dict[str, float] = {}
    for ids in ranked_id_lists:
        for rank, id_ in enumerate(ids):
            scores[id_] = scores.get(id_, 0.0) + 1.0 / (k + rank + 1)
    return sorted(scores.items(), key=lambda x: -x[1])


@app.post("/search", response_model=SearchResponse)
def search(req: SearchRequest):
    """
    Search clinical trials by condition and/or patient criteria.
    - Default: single combined query (condition + "Patient criteria: " + patient_criteria), one embedding, search all trials.
    - use_two_signals=True: two vector searches (condition vs eligibility), then merge/rerank with RRF.
    """
    n_results = min(req.n_results, 50)
    model = get_model()
    coll = get_collection()

    use_two = req.use_two_signals and (req.condition or "").strip() and (req.patient_criteria or "").strip()

    if use_two:
        # Two-signal: embed condition and patient_criteria separately, query each, merge with RRF
        fetch_per_query = min(n_results * 2, 50)
        q_condition = (req.condition or "").strip() or "clinical trial"
        q_criteria = "Patient criteria: " + (req.patient_criteria or "").strip()

        ids1, meta1, doc1, dist1 = _query_chroma(coll, model, q_condition, fetch_per_query)
        ids2, meta2, doc2, dist2 = _query_chroma(coll, model, q_criteria, fetch_per_query)

        merged = _reciprocal_rank_fusion([ids1, ids2])[:n_results]
        top_ids = [id_ for id_, _ in merged]
        rrf_scores = {id_: score for id_, score in merged}

        # Fetch full records for merged ids (Chroma get by ids)
        got = coll.get(ids=top_ids, include=["metadatas", "documents"])
        got_ids = got["ids"]
        got_metas = got.get("metadatas") or [[]] * len(got_ids)
        got_docs = got.get("documents") or [""] * len(got_ids)
        # No distances from get(); use RRF score for display
        results = _raw_to_trial_results(got_ids, got_metas, got_docs, [None] * len(got_ids))
        for r in results:
            r.score = rrf_scores.get(r.id)

        query_text = f"[two-signal] condition: {q_condition} | criteria: {q_criteria}"
        return SearchResponse(query=query_text, results=results)
    else:
        # Single combined query (default)
        parts = []
        if req.condition and req.condition.strip():
            parts.append(req.condition.strip())
        if req.patient_criteria and req.patient_criteria.strip():
            parts.append("Patient criteria: " + req.patient_criteria.strip())
        query_text = " ".join(parts) if parts else "clinical trial"

        ids, metadatas, documents, distances = _query_chroma(coll, model, query_text, n_results)
        results = _raw_to_trial_results(ids, metadatas, documents, distances)
        return SearchResponse(query=query_text, results=results)


@app.get("/health")
def health():
    return {"status": "ok"}
