"""
DocRAFT Cross-Encoder Reranker.

Primary model  : BAAI/bge-reranker-v2-m3 (568M params)
Fallback model : BAAI/bge-reranker-base (278M params)

Reranks (query, passage) pairs using a cross-encoder architecture
for high-precision retrieval in the second pass of the two-pass pipeline.
"""

import logging
import time
from typing import List, Tuple

logger = logging.getLogger(__name__)

# Constants
RERANKER_PRIMARY = "BAAI/bge-reranker-v2-m3"
RERANKER_FALLBACK = "BAAI/bge-reranker-base"


class DocRAFTReranker:
    """
    Cross-encoder reranker with automatic fallback.

    Primary  -> BAAI/bge-reranker-v2-m3   (best quality)
    Fallback -> BAAI/bge-reranker-base     (lighter, faster)

    Usage:
        reranker = DocRAFTReranker()
        scored = reranker.rerank(
            query="What is QLoRA?",
            passages=["passage 1...", "passage 2..."],
            top_n=5,
        )
        # scored = [(0, 0.95), (1, 0.72), ...]  -> List of (original_index, score)
    """

    def __init__(self):
        self._model = None
        self.model_name: str = ""
        self.backend: str = ""
        self.device: str = "cpu"
        self._init()

    def _init(self) -> None:
        """Initialize the cross-encoder. Try primary first, fall back if necessary."""
        logger.info("[Reranker] Initializing reranker model...")

        # Check torch CUDA availability
        try:
            import torch  # noqa: PLC0415
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        except ImportError:
            self.device = "cpu"

        # Attempt 1: BAAI/bge-reranker-v2-m3
        try:
            from sentence_transformers import CrossEncoder  # noqa: PLC0415

            logger.info(f"[Reranker] Loading primary model: {RERANKER_PRIMARY} on device: {self.device}...")
            # sentence-transformers CrossEncoder loads on CUDA automatically if available
            self._model = CrossEncoder(RERANKER_PRIMARY, device=self.device)
            self.model_name = RERANKER_PRIMARY
            self.backend = "sentence-transformers"

            # Warm-up
            logger.info("[Reranker] Running warm-up prediction...")
            self._model.predict([("test query", "test passage")])

            logger.info(f"[Reranker] ✓ PRIMARY model active: {self.model_name} (device={self.device})")
            return
        except Exception as primary_err:
            logger.warning(
                f"[Reranker] ✗ Primary model {RERANKER_PRIMARY} failed to load: {primary_err}\n"
                f"[Reranker]   Falling back to lighter model: {RERANKER_FALLBACK}."
            )

        # Attempt 2: BAAI/bge-reranker-base
        try:
            from sentence_transformers import CrossEncoder  # noqa: PLC0415

            logger.info(f"[Reranker] Loading fallback model: {RERANKER_FALLBACK} on device: {self.device}...")
            self._model = CrossEncoder(RERANKER_FALLBACK, device=self.device)
            self.model_name = RERANKER_FALLBACK
            self.backend = "sentence-transformers"

            # Warm-up
            logger.info("[Reranker] Running warm-up prediction...")
            self._model.predict([("test query", "test passage")])

            logger.info(f"[Reranker] ✓ FALLBACK model active: {self.model_name} (device={self.device})")
        except Exception as fallback_err:
            raise RuntimeError(
                f"[Reranker] Both reranker models failed to load.\n"
                f"  Primary error  : {primary_err}\n"
                f"  Fallback error : {fallback_err}\n"
                "Ensure sentence-transformers is installed and HuggingFace is reachable."
            ) from fallback_err

    def rerank(self, query: str, passages: List[str], top_n: int = 5) -> List[Tuple[int, float]]:
        """
        Reranks (query, passage) pairs and returns indices and scores sorted by score descending.

        Args:
            query: User search query.
            passages: List of passage texts.
            top_n: Number of results to return.

        Returns:
            List of tuples (original_index, float_score) sorted descending by score.
        """
        if not passages:
            return []

        start_time = time.perf_counter()
        
        # Build input pairs
        pairs = [(query, passage) for passage in passages]
        
        # Predict relevance scores (returns numpy float values or float array)
        scores = self._model.predict(pairs)
        
        # Zip with index, convert scores to python float for serialization
        indexed_scores = [(idx, float(score)) for idx, score in enumerate(scores)]
        
        # Sort descending by score
        indexed_scores.sort(key=lambda x: x[1], reverse=True)
        
        duration = time.perf_counter() - start_time
        logger.info(
            f"[Reranker] Reranked {len(passages)} passages in {duration:.3f}s. "
            f"Top score: {indexed_scores[0][1]:.4f} if present."
        )
        
        return indexed_scores[:top_n]

    def __repr__(self) -> str:
        return f"DocRAFTReranker(model={self.model_name!r}, device={self.device!r})"
