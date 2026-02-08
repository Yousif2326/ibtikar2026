"""
Application configuration loaded from environment variables.
Validates all required settings on import.
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


# --- OpenAI ----------------------------------------------------------------
OPENAI_API_KEY: str = _require_env("OPENAI_API_KEY")

# --- WorkOS (backend token verification) -----------------------------------
WORKOS_API_KEY: str = _require_env("WORKOS_API_KEY")
WORKOS_CLIENT_ID: str = _require_env("WORKOS_CLIENT_ID")

# --- Server -----------------------------------------------------------------
BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))
ALLOWED_ORIGINS: list[str] = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if o.strip()
]

# --- HIPAA / session --------------------------------------------------------
SESSION_TIMEOUT_MINUTES: int = int(os.getenv("SESSION_TIMEOUT_MINUTES", "15"))

# --- Rate limits (requests per minute) -------------------------------------
RATE_LIMIT_OCR: str = f"{os.getenv('RATE_LIMIT_OCR', '10')}/minute"
RATE_LIMIT_MATCH: str = f"{os.getenv('RATE_LIMIT_MATCH', '20')}/minute"
RATE_LIMIT_SEARCH: str = f"{os.getenv('RATE_LIMIT_SEARCH', '30')}/minute"

# --- Paths ------------------------------------------------------------------
CHROMA_PATH: str = str(Path(__file__).resolve().parent / "chroma_clinical_trials")
COLLECTION_NAME: str = "clinical_trials"
EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

# --- File upload limits (HIPAA: minimise attack surface) --------------------
MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB
ALLOWED_IMAGE_TYPES: set[str] = {"image/jpeg", "image/png", "image/webp", "image/tiff"}
ALLOWED_FILE_EXTENSIONS: set[str] = {".jpg", ".jpeg", ".png", ".webp", ".tiff", ".tif"}
