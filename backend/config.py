# config.py – Centralised application settings
#
# Reads ALL values from backend/.env (copy .env.example → .env to get started).
# Works correctly regardless of which directory you run uvicorn from.

import os
from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# ── Resolve the .env file path relative to THIS file (config.py) ──
# This guarantees the correct .env is found whether you run:
#   uvicorn main:app              (from backend/)
#   uvicorn backend.main:app      (from project root)
#   python -m uvicorn main:app    (from anywhere)
_ENV_FILE = Path(__file__).parent / ".env"

# Load .env into os.environ BEFORE pydantic-settings reads it.
# override=False means real environment variables always win over .env values.
load_dotenv(dotenv_path=_ENV_FILE, override=False)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),   # absolute path — works from any CWD
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Gemini AI ──────────────────────────────────────────────────
    # Get your free key at: https://aistudio.google.com/app/apikey
    GEMINI_API_KEY: str = "MISSING_GEMINI_KEY"

    # Which Gemini model to use.
    # "gemini-1.5-flash"  -> fast, free tier (default)
    # "gemini-1.5-pro"    -> smarter, lower quota
    GEMINI_MODEL: str = "gemini-2.5-flash-preview-04-17"

    # ── JWT Auth ───────────────────────────────────────────────────
    SECRET_KEY: str = "insecure-dev-secret-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ── ScaleDown PDF Compression (optional) ──────────────────────
    SCALEDOWN_API_KEY: str = ""
    SCALEDOWN_API_URL: str = "https://api.scaledown.io/v1/compress"

    # ── Storage paths ──────────────────────────────────────────────
    DATABASE_URL: str = "sqlite:///./data/pathshala.db"
    CHROMA_DB_PATH: str = "./data/chroma_db"


settings = Settings()

# ── Startup validation ─────────────────────────────────────────────
if settings.GEMINI_API_KEY == "MISSING_GEMINI_KEY":
    import warnings
    warnings.warn(
        "\n\n"
        "  WARNING: GEMINI_API_KEY is not set!\n"
        f"  Expected .env file at: {_ENV_FILE}\n"
        "  Steps to fix:\n"
        "    1. cd backend\n"
        "    2. cp .env.example .env\n"
        "    3. Open .env and set: GEMINI_API_KEY=your_key_here\n"
        "  Get a free key at: https://aistudio.google.com/app/apikey\n",
        stacklevel=2,
    )
