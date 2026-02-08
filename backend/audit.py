"""
HIPAA-compliant audit logger.

Logs structured events (who, when, what action, metadata) WITHOUT any PHI.
Uses rotating file handler so logs don't grow unbounded.
"""

import logging
import os
import json
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path

_LOG_DIR = Path(__file__).resolve().parent / "logs"
_LOG_DIR.mkdir(exist_ok=True)
_LOG_FILE = _LOG_DIR / "audit.log"

# Max 5 MB per file, keep 5 backups = 25 MB total
_MAX_BYTES = 5 * 1024 * 1024
_BACKUP_COUNT = 5


def _build_logger() -> logging.Logger:
    logger = logging.getLogger("audit")
    logger.setLevel(logging.INFO)
    logger.propagate = False

    if not logger.handlers:
        handler = RotatingFileHandler(
            _LOG_FILE, maxBytes=_MAX_BYTES, backupCount=_BACKUP_COUNT
        )
        handler.setFormatter(logging.Formatter("%(message)s"))
        logger.addHandler(handler)
    return logger


_logger = _build_logger()


def log_event(
    *,
    user_id: str | None,
    action: str,
    detail: str = "",
    metadata: dict | None = None,
) -> None:
    """
    Write one audit record.

    Parameters
    ----------
    user_id : str or None
        The authenticated user's identifier (email or WorkOS user ID).
        NEVER pass patient identifiers here.
    action : str
        Short action label, e.g. "ocr_request", "match_request", "search", "login".
    detail : str
        Non-PHI description. E.g. "uploaded image 240 KB" or "returned 10 trials".
        NEVER include patient names, conditions, or any clinical text.
    metadata : dict or None
        Optional structured data (again, NO PHI).
    """
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user_id": user_id or "anonymous",
        "action": action,
        "detail": detail,
    }
    if metadata:
        record["metadata"] = metadata
    _logger.info(json.dumps(record, default=str))
