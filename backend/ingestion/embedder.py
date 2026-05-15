"""
DocRAFT Smart Embedding Wrapper.

Primary model  : BAAI/bge-large-en (SentenceTransformers, 1024-dim)
Fallback model : nomic-embed-text (Ollama, 768-dim)

If the BGE model fails to load for any reason (missing weights, CUDA OOM, etc.)
the embedder automatically falls back to nomic-embed-text and logs a clear
warning. All callers use the same interface regardless of which backend is active.
"""

import logging
from typing import List

from ollama import Client as OllamaClient

from .config import EMBED_MODEL, OLLAMA_HOST

logger = logging.getLogger(__name__)

# BGE instruction prefix — recommended by BAAI for asymmetric retrieval tasks.
# Applied ONLY to query embeddings, NOT to document chunk embeddings.
BGE_QUERY_INSTRUCTION = "Represent this sentence for searching relevant passages: "


class DocRAFTEmbedder:
    """
    Smart embedding wrapper with automatic fallback.

    Primary  → BAAI/bge-large-en  (sentence-transformers, 1024-dim)
    Fallback → nomic-embed-text         (Ollama, 768-dim)

    Usage:
        embedder = DocRAFTEmbedder()
        doc_vec   = embedder.embed("chunk of document text")
        query_vec = embedder.embed_query("user question here")
        print(embedder.model_name, embedder.vector_size)
    """

    def __init__(self):
        self._st_model = None        # SentenceTransformer instance (BGE)
        self._ollama: OllamaClient | None = None  # Ollama client (fallback)
        self.backend: str = ""       # "sentence-transformers" | "ollama"
        self.model_name: str = ""    # human-readable model identifier
        self.vector_size: int = 0    # embedding dimensionality

        self._init()

    # ── Initialisation ────────────────────────────────────────────────────────

    def _init(self) -> None:
        """Try BGE first. On any failure, fall back to Ollama/nomic."""
        logger.info("[Embedder] Initializing embedding backend...")

        # ── Attempt 1: BAAI/bge-large-en-v1.5 via sentence-transformers ──────
        try:
            from sentence_transformers import SentenceTransformer  # noqa: PLC0415

            logger.info("[Embedder] Loading BAAI/bge-large-en from HuggingFace cache...")
            model = SentenceTransformer("BAAI/bge-large-en")

            # Warm-up / dimension probe
            test_vec = model.encode("test", normalize_embeddings=True)

            self._st_model = model
            self.backend = "sentence-transformers"
            self.model_name = "BAAI/bge-large-en"
            self.vector_size = len(test_vec)

            logger.info(
                f"[Embedder] ✓ PRIMARY model active: {self.model_name} "
                f"(backend=sentence-transformers, dim={self.vector_size})"
            )
            return

        except Exception as bge_err:
            logger.warning(
                f"[Embedder] ✗ BGE model failed to load: {bge_err}\n"
                f"[Embedder]   Falling back to FALLBACK model: {EMBED_MODEL} via Ollama."
            )

        # ── Attempt 2: nomic-embed-text via Ollama ────────────────────────────
        try:
            client = OllamaClient(host=OLLAMA_HOST)
            test_vec = client.embeddings(model=EMBED_MODEL, prompt="test")["embedding"]

            self._ollama = client
            self.backend = "ollama"
            self.model_name = EMBED_MODEL
            self.vector_size = len(test_vec)

            logger.info(
                f"[Embedder] ✓ FALLBACK model active: {self.model_name} "
                f"(backend=ollama, dim={self.vector_size})"
            )

        except Exception as ollama_err:
            raise RuntimeError(
                f"[Embedder] Both embedding backends failed.\n"
                f"  BGE error    : {bge_err}\n"
                f"  Ollama error : {ollama_err}\n"
                "Ensure either sentence-transformers+BAAI/bge-large-en-v1.5 "
                "or Ollama with nomic-embed-text is available."
            ) from ollama_err

    # ── Public API ────────────────────────────────────────────────────────────

    def embed(self, text: str) -> List[float]:
        """
        Embed a document chunk. No instruction prefix is applied.

        Args:
            text: Raw text of the chunk to embed.

        Returns:
            List of floats representing the dense embedding vector.
        """
        if self.backend == "sentence-transformers":
            vec = self._st_model.encode(text, normalize_embeddings=True)
            return vec.tolist()
        else:
            response = self._ollama.embeddings(model=self.model_name, prompt=text)
            return response["embedding"]

    def embed_query(self, query: str) -> List[float]:
        """
        Embed a search query. For BGE, prepends the asymmetric retrieval
        instruction recommended by BAAI to improve retrieval precision.

        Args:
            query: The user's natural-language search query.

        Returns:
            List of floats representing the query embedding vector.
        """
        if self.backend == "sentence-transformers":
            # BGE asymmetric retrieval: instruction on query side only
            prefixed_query = f"{BGE_QUERY_INSTRUCTION}{query}"
            vec = self._st_model.encode(prefixed_query, normalize_embeddings=True)
            return vec.tolist()
        else:
            response = self._ollama.embeddings(model=self.model_name, prompt=query)
            return response["embedding"]

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Embed a list of document chunks efficiently (batch mode).

        Args:
            texts: List of raw text chunks.

        Returns:
            List of embedding vectors (same order as input).
        """
        if self.backend == "sentence-transformers":
            vecs = self._st_model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
            return [v.tolist() for v in vecs]
        else:
            # Ollama has no native batch API — embed sequentially
            return [self.embed(t) for t in texts]

    def __repr__(self) -> str:
        return (
            f"DocRAFTEmbedder(model={self.model_name!r}, "
            f"backend={self.backend!r}, dim={self.vector_size})"
        )
