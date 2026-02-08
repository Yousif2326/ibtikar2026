"""
Configuration for the ingestion script.
Loads environment variables from .env in the backend directory.

The backend is now ingestion-only — it loads clinical trial data from CSV
into ChromaDB Cloud. All search/query functionality lives in the frontend.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the backend directory
_env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(_env_path)


def _require_env(key: str) -> str:
    """Return the value of an environment variable or raise on missing."""
    value = os.getenv(key)
    if not value or value.startswith("your-"):
        raise RuntimeError(
            f"Missing or placeholder environment variable: {key}. "
            f"Set it in {_env_path}"
        )
    return value


# --- OpenAI (for text-embedding-3-small during ingestion) -------------------
OPENAI_API_KEY: str = _require_env("OPENAI_API_KEY")

# --- ChromaDB Cloud ---------------------------------------------------------
CHROMA_API_KEY: str = _require_env("CHROMA_API_KEY")
CHROMA_TENANT: str = _require_env("CHROMA_TENANT")
CHROMA_DATABASE: str = _require_env("CHROMA_DATABASE")

# --- Collection settings ----------------------------------------------------
COLLECTION_NAME: str = "clinical_trials"
EMBEDDING_MODEL: str = "text-embedding-3-small"
