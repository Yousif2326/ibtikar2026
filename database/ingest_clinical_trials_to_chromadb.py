"""
Ingest clinical trials into ChromaDB from the merged CTG CSV.
- Embed text-rich columns (semantic search).
- Store the rest as metadata (filtering).
- Uses ctg-studies-merged.csv (merge the three CTG CSVs first with merge_ctg_datasets.py).
"""

import os
import pandas as pd
import chromadb
from sentence_transformers import SentenceTransformer

# ---------------------------------------------------------------------------
# Data source: merged CTG CSV (columns: NCT Number, Study Title, Study URL, ...)
# ---------------------------------------------------------------------------
CHROMA_PATH = os.path.join(os.path.dirname(__file__), "chroma_clinical_trials")
DATA_PATH = os.path.join(os.path.dirname(__file__), "ctg-studies-merged.csv")
COLLECTION_NAME = "clinical_trials"
BATCH_SIZE = 200
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
# CTG CSV uses "NCT Number" as id; we store it as "ID" in metadata for API compatibility
ID_COLUMN = "NCT Number"

# Columns in ctg-studies-merged.csv (exact match – no eligibilityCriteria, Inclusion, Exclusion, detailedDescription)
CSV_TEXT_COLUMNS = [
    "Study Title",
    "Acronym",
    "Brief Summary",
    "Study Results",
    "Conditions",
    "Interventions",
    "Primary Outcome Measures",
    "Secondary Outcome Measures",
    "Other Outcome Measures",
    "Study Design",
]

# Metadata stored in ChromaDB (ID is set from NCT Number; only columns that exist in CSV)
CSV_METADATA_COLUMNS = [
    "ID",  # filled from NCT Number
    "Study Title",
    "Study URL",
    "Study Status",
    "Sex",
    "Age",
    "Phases",
    "Enrollment",
    "Funder Type",
    "Study Type",
    "Sponsor",
    "Collaborators",
    "Conditions",
    "Interventions",
]


def safe_str(v):
    if pd.isna(v) or v is None:
        return ""
    return str(v).strip()


def row_to_document(row: pd.Series) -> str:
    """Build one searchable text document from CSV text columns only."""
    parts = []
    for col in CSV_TEXT_COLUMNS:
        if col in row.index:
            val = safe_str(row[col])
            if val:
                parts.append(val)
    return "\n".join(parts) if parts else "(no text)"


def row_to_metadata(row: pd.Series) -> dict:
    """Build ChromaDB-safe metadata from CSV columns. ID = NCT Number."""
    meta = {}
    for col in CSV_METADATA_COLUMNS:
        if col not in row.index:
            if col == "ID" and ID_COLUMN in row.index:
                meta["ID"] = safe_str(row[ID_COLUMN])[:500]
            continue
        v = row[col]
        if pd.isna(v):
            meta[col] = ""
        elif isinstance(v, (bool, int, float)):
            meta[col] = v
        else:
            meta[col] = str(v)[:500]
    if "ID" not in meta and ID_COLUMN in row.index:
        meta["ID"] = safe_str(row[ID_COLUMN])[:500]
    return meta


def main():
    if not os.path.isfile(DATA_PATH):
        raise SystemExit(
            f"Data file not found: {DATA_PATH}\n"
            "Run: python merge_ctg_datasets.py"
        )

    print("Loading CSV...")
    df = pd.read_csv(DATA_PATH)
    n = len(df)
    print(f"Rows: {n}")

    print("Loading embedding model...")
    model = SentenceTransformer(EMBEDDING_MODEL)

    print("Connecting to ChromaDB (persistent)...")
    client = chromadb.PersistentClient(path=CHROMA_PATH)
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass
    collection = client.create_collection(
        name=COLLECTION_NAME,
        metadata={"description": "Clinical trials from merged CTG CSV"},
    )

    print("Building documents and metadata...")
    documents = []
    metadatas = []
    ids = []
    for i, row in df.iterrows():
        doc = row_to_document(row)
        documents.append(doc)
        meta = row_to_metadata(row)
        metadatas.append(meta)
        trial_id = safe_str(row.get(ID_COLUMN, row.get("ID", i)))
        ids.append(trial_id or f"trial_{i}")

    print("Embedding and adding to ChromaDB in batches...")
    for start in range(0, n, BATCH_SIZE):
        end = min(start + BATCH_SIZE, n)
        batch_docs = documents[start:end]
        batch_embeddings = model.encode(batch_docs).tolist()
        collection.add(
            ids=ids[start:end],
            embeddings=batch_embeddings,
            documents=batch_docs,
            metadatas=metadatas[start:end],
        )
        print(f"  {start}-{end} / {n}")

    print("Done.")
    print(f"ChromaDB stored at: {os.path.abspath(CHROMA_PATH)}")
    print(f"Collection: {COLLECTION_NAME}")
    print("\nSearch via the app (npm run dev + npm run api) or the search API directly.")


if __name__ == "__main__":
    main()
