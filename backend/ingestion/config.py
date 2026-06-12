"""
Ingestion pipeline configuration.
Tunable parameters for document conversion, chunking, and storage.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# ── Environment ──────────────────────────────────────────────────────────────
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# ── Ollama ───────────────────────────────────────────────────────────────────
OLLAMA_HOST: str = os.getenv("OLLAMA_HOST", "http://localhost:11434")
EMBED_MODEL: str = os.getenv("EMBED_MODEL", "nomic-embed-text")

# ── Qdrant ───────────────────────────────────────────────────────────────────
QDRANT_HOST: str = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT: int = int(os.getenv("QDRANT_PORT", "6333"))
COLLECTION_NAME: str = "docraft_knowledge"

# ── Paths ────────────────────────────────────────────────────────────────────
PROJECT_ROOT: Path = Path(__file__).parent.parent.parent
PDF_INPUT_DIR: Path = PROJECT_ROOT / "data" / "pdfs"
MARKDOWN_OUTPUT_DIR: Path = PROJECT_ROOT / "data" / "markdown"
IMAGE_OUTPUT_DIR: Path = PROJECT_ROOT / "data" / "images"

# ── Images & Vision ──────────────────────────────────────────────────────────
VISION_MODEL: str = os.getenv("VISION_MODEL", "granite3.2-vision:2b")

# 1500-char chunks are ideal to capture complete tables and paragraphs while staying within the model's high-fidelity context window.
CHUNK_SIZE: int = 1500
CHUNK_OVERLAP: int = 150

# ── Reranker & Two-Pass Retrieval ────────────────────────────────────────────
RERANKER_PRIMARY: str = "BAAI/bge-reranker-v2-m3"
RERANKER_FALLBACK: str = "BAAI/bge-reranker-base"

# Two-pass retrieval parameters:
# RETRIEVAL_CANDIDATE_K = number of candidate chunks retrieved in Phase 1 (broad recall)
# RETRIEVAL_RERANK_N   = number of high-quality chunks kept in Phase 2 (high precision)
RETRIEVAL_CANDIDATE_K: int = 15
RETRIEVAL_RERANK_N: int = 5

