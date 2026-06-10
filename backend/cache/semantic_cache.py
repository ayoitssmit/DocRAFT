"""
Semantic cache for DocRAFT query results.
Stores (query_embedding, document_filter, results) tuples in memory.
On each new query, computes cosine similarity against all cached embeddings.
If similarity exceeds SIMILARITY_THRESHOLD, returns cached results instantly.
Uses an asyncio.Lock for thread safety since FastAPI runs async handlers.
LRU eviction kicks in when MAX_ENTRIES is reached.
"""

import time
import asyncio
import numpy as np
from typing import Optional

SIMILARITY_THRESHOLD = 0.92  # tune between 0.88 and 0.95
MAX_ENTRIES = 100             # max cached queries per server session


class SemanticCache:
    def __init__(self):
        self._entries: list[dict] = []
        self._lock = asyncio.Lock()

    def _cosine_similarity(self, a: list[float], b: list[float]) -> float:
        va = np.array(a, dtype=np.float32)
        vb = np.array(b, dtype=np.float32)
        denom = np.linalg.norm(va) * np.linalg.norm(vb)
        if denom == 0:
            return 0.0
        return float(np.dot(va, vb) / denom)

    async def lookup(
        self,
        query_embedding: list[float],
        document_filter: Optional[str],
    ) -> Optional[list]:
        """
        Returns cached results if a semantically similar query exists
        for the same document_filter context. Returns None on cache miss.
        """
        async with self._lock:
            for entry in self._entries:
                # CRITICAL: never return cache across different document contexts
                if entry["document_filter"] != document_filter:
                    continue
                sim = self._cosine_similarity(
                    query_embedding, entry["query_embedding"]
                )
                if sim >= SIMILARITY_THRESHOLD:
                    entry["hit_count"] += 1
                    entry["last_accessed"] = time.time()
                    return entry["results"]
        return None

    async def store(
        self,
        query_embedding: list[float],
        document_filter: Optional[str],
        results: list,
    ) -> None:
        """Store a new query result. Evicts LRU entry if at capacity."""
        async with self._lock:
            # Evict least recently used entry when full
            if len(self._entries) >= MAX_ENTRIES:
                self._entries.sort(key=lambda e: e["last_accessed"])
                self._entries.pop(0)

            self._entries.append({
                "query_embedding": query_embedding,
                "document_filter": document_filter,
                "results": results,
                "hit_count": 0,
                "created_at": time.time(),
                "last_accessed": time.time(),
            })

    async def invalidate_document(self, document_filter: str) -> None:
        """
        Remove all cache entries for a specific document.
        Called automatically when a new document is uploaded.
        """
        async with self._lock:
            self._entries = [
                e for e in self._entries
                if e["document_filter"] != document_filter
            ]

    async def clear(self) -> None:
        async with self._lock:
            self._entries.clear()

    @property
    def size(self) -> int:
        return len(self._entries)
