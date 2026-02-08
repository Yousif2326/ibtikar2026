"""
Ingest clinical trials into ChromaDB Cloud from the merged CTG CSV.
- Uses OpenAI text-embedding-3-small for embeddings (same model used in frontend queries).
- Connects to Chroma Cloud via CloudClient.
- Embed text-rich columns (semantic search).
- Store the rest as metadata (filtering).
- Uses ctg-studies-merged.csv (merge the three CTG CSVs first with merge_ctg_datasets.py).

Features:
  - Checkpoint/resume: saves progress to a JSON file so interrupted runs can resume
  - Exponential backoff with jitter for API rate limits
  - Progress logging with ETA
  - Configurable batch size (default 100; OpenAI supports up to 2048 per call)

Required environment variables (in .env):
  CHROMA_API_KEY     - Chroma Cloud API key
  CHROMA_TENANT      - Chroma Cloud tenant ID
  CHROMA_DATABASE    - Chroma Cloud database name
  OPENAI_API_KEY     - OpenAI API key (for text-embedding-3-small)
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone

import pandas as pd
import chromadb
import chromadb.utils.embedding_functions as embedding_functions
from dotenv import load_dotenv

# Load .env from the backend directory
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DATA_PATH = os.path.join(os.path.dirname(__file__), "ctg-studies-merged.csv")
CHECKPOINT_PATH = os.path.join(os.path.dirname(__file__), "ingestion_checkpoint.json")
COLLECTION_NAME = "clinical_trials"
DEFAULT_BATCH_SIZE = 100
EMBEDDING_MODEL = "text-embedding-3-small"

# ChromaDB Cloud document size limit is 16384 bytes; chunk documents to stay under it
MAX_DOCUMENT_BYTES = 15_500  # Leave margin under 16384

# Retry configuration
MAX_RETRIES = 8
BASE_DELAY = 1.0       # seconds
MAX_DELAY = 120.0      # seconds
JITTER_FACTOR = 0.5    # random jitter as fraction of delay

# Chroma Cloud credentials
CHROMA_API_KEY = os.getenv("CHROMA_API_KEY", "")
CHROMA_TENANT = os.getenv("CHROMA_TENANT", "")
CHROMA_DATABASE = os.getenv("CHROMA_DATABASE", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# CTG CSV uses "NCT Number" as id
ID_COLUMN = "NCT Number"

# Columns in ctg-studies-merged.csv (exact match)
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


def chunk_document(text: str, max_bytes: int = MAX_DOCUMENT_BYTES) -> list[str]:
    """
    Split text into chunks each under max_bytes (UTF-8).
    Tries to split on newlines to avoid mid-sentence cuts.
    """
    if not text or len(text.encode("utf-8")) <= max_bytes:
        return [text] if text else ["(no text)"]
    chunks = []
    current = []
    current_len = 0
    for part in text.split("\n"):
        part_bytes = (part + "\n").encode("utf-8")
        part_len = len(part_bytes)
        if current_len + part_len <= max_bytes:
            current.append(part)
            current_len += part_len
        else:
            if current:
                chunks.append("\n".join(current))
            if part_len <= max_bytes:
                current = [part]
                current_len = part_len
            else:
                # Single line too long: split by bytes (safe for UTF-8)
                seg = ""
                for char in part:
                    if len((seg + char).encode("utf-8")) <= max_bytes:
                        seg += char
                    else:
                        if seg:
                            chunks.append(seg)
                        seg = char
                if seg:
                    chunks.append(seg)
                current = []
                current_len = 0
    if current:
        chunks.append("\n".join(current))
    return chunks


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


def retry_with_backoff(fn, batch_label: str):
    """
    Call fn() with exponential backoff + jitter on transient failures.
    Retries on rate-limit (429), server errors (5xx), and connection errors.
    """
    import random

    for attempt in range(MAX_RETRIES + 1):
        try:
            return fn()
        except Exception as e:
            error_str = str(e).lower()
            is_rate_limit = "429" in error_str or "rate" in error_str or "too many" in error_str
            is_server_error = any(code in error_str for code in ["500", "502", "503", "504"])
            is_connection = any(kw in error_str for kw in ["connection", "timeout", "timed out", "reset"])

            if attempt == MAX_RETRIES or not (is_rate_limit or is_server_error or is_connection):
                # Non-retryable error or exhausted retries
                raise

            delay = min(BASE_DELAY * (2 ** attempt), MAX_DELAY)
            jitter = delay * JITTER_FACTOR * random.random()
            wait = delay + jitter

            error_type = "rate-limit" if is_rate_limit else "server-error" if is_server_error else "connection"
            print(f"  [{batch_label}] {error_type} (attempt {attempt + 1}/{MAX_RETRIES}), "
                  f"retrying in {wait:.1f}s... ({type(e).__name__}: {str(e)[:120]})")
            time.sleep(wait)


def format_duration(seconds: float) -> str:
    """Format seconds into human-readable duration."""
    if seconds < 60:
        return f"{seconds:.0f}s"
    elif seconds < 3600:
        return f"{seconds / 60:.1f}m"
    else:
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        return f"{h}h {m}m"


# ---------------------------------------------------------------------------
# Checkpoint management
# ---------------------------------------------------------------------------

def load_checkpoint() -> dict:
    """Load checkpoint from disk. Returns dict with 'completed_batches' set."""
    if os.path.isfile(CHECKPOINT_PATH):
        try:
            with open(CHECKPOINT_PATH, "r") as f:
                data = json.load(f)
            # Ensure it's a dict with the expected key
            if isinstance(data, dict) and "completed_batches" in data:
                return data
        except (json.JSONDecodeError, IOError):
            pass
    return {"completed_batches": [], "total_docs": 0, "started_at": None}


def save_checkpoint(checkpoint: dict):
    """Persist checkpoint to disk."""
    with open(CHECKPOINT_PATH, "w") as f:
        json.dump(checkpoint, f)


def clear_checkpoint():
    """Remove checkpoint file."""
    if os.path.isfile(CHECKPOINT_PATH):
        os.remove(CHECKPOINT_PATH)
        print("Checkpoint file removed.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Ingest clinical trials into ChromaDB Cloud")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE,
                        help=f"Documents per batch (default: {DEFAULT_BATCH_SIZE})")
    parser.add_argument("--fresh", action="store_true",
                        help="Delete existing collection and start fresh (ignores checkpoint)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Build documents but don't upload (useful to check chunking)")
    args = parser.parse_args()

    batch_size = args.batch_size

    # Validate environment
    missing = []
    if not CHROMA_API_KEY:
        missing.append("CHROMA_API_KEY")
    if not CHROMA_TENANT:
        missing.append("CHROMA_TENANT")
    if not CHROMA_DATABASE:
        missing.append("CHROMA_DATABASE")
    if not OPENAI_API_KEY:
        missing.append("OPENAI_API_KEY")
    if missing:
        raise SystemExit(
            f"Missing environment variables: {', '.join(missing)}\n"
            "Set them in backend/.env"
        )

    if not os.path.isfile(DATA_PATH):
        raise SystemExit(
            f"Data file not found: {DATA_PATH}\n"
            "Run: python merge_ctg_datasets.py"
        )

    print("=" * 60)
    print("Clinical Trials Ingestion to ChromaDB Cloud")
    print("=" * 60)

    # -----------------------------------------------------------------------
    # 1. Load CSV and build document list
    # -----------------------------------------------------------------------
    print("\n[1/4] Loading CSV...")
    df = pd.read_csv(DATA_PATH)
    n = len(df)
    print(f"  Rows in CSV: {n:,}")

    print("\n[2/4] Building documents and metadata (chunking when over Chroma size limit)...")
    documents = []
    metadatas = []
    ids = []
    for i, row in df.iterrows():
        doc = row_to_document(row)
        meta = row_to_metadata(row)
        trial_id = safe_str(row.get(ID_COLUMN, row.get("ID", i))) or f"trial_{i}"
        for chunk_idx, chunk_text in enumerate(chunk_document(doc)):
            documents.append(chunk_text)
            metadatas.append(meta)
            ids.append(f"{trial_id}_chunk_{chunk_idx}" if chunk_idx > 0 else trial_id)

    total_docs = len(documents)
    chunked_count = total_docs - n
    print(f"  Total documents: {total_docs:,} ({n:,} trials + {chunked_count:,} extra chunks)")

    if args.dry_run:
        print("\n[DRY RUN] Skipping upload. Document stats:")
        sizes = [len(d.encode("utf-8")) for d in documents]
        print(f"  Min doc size: {min(sizes):,} bytes")
        print(f"  Max doc size: {max(sizes):,} bytes")
        print(f"  Avg doc size: {sum(sizes) // len(sizes):,} bytes")
        print(f"  Total data:   {sum(sizes) / 1_000_000:.1f} MB")
        return

    # -----------------------------------------------------------------------
    # 2. Connect to ChromaDB Cloud
    # -----------------------------------------------------------------------
    print(f"\n[3/4] Connecting to Chroma Cloud...")
    print(f"  Tenant:     {CHROMA_TENANT}")
    print(f"  Database:   {CHROMA_DATABASE}")
    print(f"  Collection: {COLLECTION_NAME}")
    print(f"  Embedding:  {EMBEDDING_MODEL}")
    print(f"  Batch size: {batch_size}")

    openai_ef = embedding_functions.OpenAIEmbeddingFunction(
        api_key=OPENAI_API_KEY,
        model_name=EMBEDDING_MODEL,
    )

    client = chromadb.CloudClient(
        tenant=CHROMA_TENANT,
        database=CHROMA_DATABASE,
        api_key=CHROMA_API_KEY,
    )

    # Handle fresh vs. resume
    checkpoint = load_checkpoint()

    if args.fresh:
        try:
            client.delete_collection(COLLECTION_NAME)
            print(f"  Deleted existing collection: {COLLECTION_NAME}")
        except Exception:
            pass
        clear_checkpoint()
        checkpoint = {"completed_batches": [], "total_docs": total_docs, "started_at": None}

    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"description": "Clinical trials from merged CTG CSV"},
        embedding_function=openai_ef,
    )

    # -----------------------------------------------------------------------
    # 3. Upload in batches with retry and checkpoint
    # -----------------------------------------------------------------------
    total_batches = (total_docs + batch_size - 1) // batch_size
    completed_set = set(checkpoint.get("completed_batches", []))
    skipped = len(completed_set)

    if skipped > 0:
        print(f"\n  Resuming: {skipped} batches already completed, {total_batches - skipped} remaining")

    if not checkpoint.get("started_at"):
        checkpoint["started_at"] = datetime.now(timezone.utc).isoformat()
        checkpoint["total_docs"] = total_docs

    print(f"\n[4/4] Uploading {total_docs:,} documents in {total_batches:,} batches...")
    print("  (Embeddings generated via OpenAI API -- this may take a while)\n")

    start_time = time.time()
    batches_done_this_run = 0
    errors_total = 0

    for batch_idx in range(total_batches):
        start = batch_idx * batch_size
        end = min(start + batch_size, total_docs)
        batch_label = f"batch {batch_idx + 1}/{total_batches}"

        # Skip already-completed batches
        if batch_idx in completed_set:
            continue

        # Upload with retry
        try:
            def do_add(s=start, e=end):
                collection.add(
                    ids=ids[s:e],
                    documents=documents[s:e],
                    metadatas=metadatas[s:e],
                )

            retry_with_backoff(do_add, batch_label)
        except Exception as e:
            errors_total += 1
            print(f"\n  FAILED {batch_label} after {MAX_RETRIES} retries: {e}")
            print(f"  Saving checkpoint and stopping. Re-run to resume from batch {batch_idx + 1}.")
            save_checkpoint(checkpoint)
            raise SystemExit(1)

        # Mark batch complete
        batches_done_this_run += 1
        completed_set.add(batch_idx)
        checkpoint["completed_batches"] = sorted(completed_set)
        save_checkpoint(checkpoint)

        # Progress logging with ETA
        total_completed = len(completed_set)
        remaining = total_batches - total_completed
        elapsed = time.time() - start_time
        if batches_done_this_run > 0:
            avg_per_batch = elapsed / batches_done_this_run
            eta = avg_per_batch * remaining
            pct = (total_completed / total_batches) * 100
            docs_done = min(total_completed * batch_size, total_docs)
            print(f"  {batch_label} done | {docs_done:,}/{total_docs:,} docs ({pct:.1f}%) | "
                  f"elapsed {format_duration(elapsed)} | ETA {format_duration(eta)}")
        else:
            print(f"  {batch_label} done")

    # -----------------------------------------------------------------------
    # 4. Summary
    # -----------------------------------------------------------------------
    elapsed_total = time.time() - start_time
    print("\n" + "=" * 60)
    print("INGESTION COMPLETE")
    print("=" * 60)
    print(f"  Collection:       {COLLECTION_NAME}")
    print(f"  Chroma tenant:    {CHROMA_TENANT}")
    print(f"  Chroma database:  {CHROMA_DATABASE}")
    print(f"  Embedding model:  {EMBEDDING_MODEL}")
    print(f"  Total documents:  {total_docs:,}")
    print(f"  Total batches:    {total_batches:,}")
    print(f"  Batches this run: {batches_done_this_run}")
    print(f"  Time this run:    {format_duration(elapsed_total)}")
    if errors_total:
        print(f"  Errors (retried): {errors_total}")
    print(f"\nQuery via the frontend app (pnpm dev).")

    # Clean up checkpoint on successful completion
    clear_checkpoint()


if __name__ == "__main__":
    main()
