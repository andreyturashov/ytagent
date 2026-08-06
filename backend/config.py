from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent
REPO_ROOT = ROOT_DIR.parent

# Load environment from backend/.env first, then repo root .env.
# Do not override already-set OS environment values.
load_dotenv(dotenv_path=ROOT_DIR / ".env", override=False)
load_dotenv(dotenv_path=REPO_ROOT / ".env", override=False)

POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "ytagent")
DATABASE_URL = os.getenv("DATABASE_URL")


def build_database_url() -> str:
    if DATABASE_URL:
        return DATABASE_URL

    return (
        f"postgresql+asyncpg://{quote_plus(POSTGRES_USER)}:"
        f"{quote_plus(POSTGRES_PASSWORD)}@{POSTGRES_HOST}:"
        f"{POSTGRES_PORT}/{POSTGRES_DB}"
    )


# LLM model selection used by integrations that consume a model name
LLAMA_MODEL = os.getenv("LLAMA_MODEL", "llama3.1")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", os.getenv("LLAMA_MODEL", "qwen2.5:14b"))
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
