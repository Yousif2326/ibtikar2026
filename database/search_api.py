"""
FastAPI server: query ChromaDB by condition + patient criteria.
Run: uvicorn search_api:app --reload --port 8000
"""

import os
from typing import Optional

import chromadb
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

CHROMA_PATH = os.path.join(os.path.dirname(__file__), "chroma_clinical_trials")
COLLECTION_NAME = "clinical_trials"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

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
    n_results: int = 10


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


@app.post("/search", response_model=SearchResponse)
def search(req: SearchRequest):
    """Build query from condition + patient criteria, search ChromaDB, return structured results."""
    parts = []
    if req.condition and req.condition.strip():
        parts.append(req.condition.strip())
    if req.patient_criteria and req.patient_criteria.strip():
        parts.append("Patient criteria: " + req.patient_criteria.strip())
    query_text = " ".join(parts) if parts else "clinical trial"

    model = get_model()
    coll = get_collection()
    query_embedding = model.encode([query_text]).tolist()
    raw = coll.query(
        query_embeddings=query_embedding,
        n_results=min(req.n_results, 50),
        include=["documents", "metadatas", "distances"],
    )

    ids = raw["ids"][0]
    metadatas = raw["metadatas"][0]
    documents = raw["documents"][0]
    distances = (raw.get("distances") or [None])[0]

    results = []
    for i in range(len(ids)):
        meta = metadatas[i] if metadatas else {}
        doc = documents[i] if documents else ""
        # ChromaDB L2 distance: lower = more similar; convert to a simple score for display (optional)
        dist = distances[i] if distances and i < len(distances) else None
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

    return SearchResponse(query=query_text, results=results)


@app.get("/health")
def health():
    return {"status": "ok"}
