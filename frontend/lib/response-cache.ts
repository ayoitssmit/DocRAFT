/**
 * In-memory LLM response cache for DocRAFT.
 * Stores complete LLM responses keyed by a normalized query string.
 * Uses exact string matching after normalization (lowercase, collapse whitespace,
 * strip punctuation) as the frontend cache key — the backend handles
 * semantic similarity matching. This layer only catches truly identical
 * or near-identical repeated queries without needing embedding computation.
 *
 * Max 50 entries. LRU eviction.
 */

const MAX_ENTRIES = 50;

interface CacheEntry {
  sources: unknown[];
  llmResponse: string;
  documentFilter: string[];
  lastAccessed: number;
  hitCount: number;
}

const cache = new Map<string, CacheEntry>();

function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, "")   // strip punctuation
    .replace(/\s+/g, " ")      // collapse whitespace
    .trim();
}

function makeCacheKey(query: string, documentFilter: string[]): string {
  const filterKey = documentFilter.length > 0 ? documentFilter.slice().sort().join(",") : "all";
  return `${normalizeQuery(query)}__${filterKey}`;
}

export function getCachedResponse(
  query: string,
  documentFilter: string[]
): CacheEntry | null {
  const key = makeCacheKey(query, documentFilter);
  const entry = cache.get(key);
  if (!entry) return null;
  entry.lastAccessed = Date.now();
  entry.hitCount += 1;
  return entry;
}

export function setCachedResponse(
  query: string,
  documentFilter: string[],
  sources: unknown[],
  llmResponse: string
): void {
  // Evict LRU entry if at capacity
  if (cache.size >= MAX_ENTRIES) {
    let lruKey = "";
    let lruTime = Infinity;
    for (const [k, v] of cache.entries()) {
      if (v.lastAccessed < lruTime) {
        lruTime = v.lastAccessed;
        lruKey = k;
      }
    }
    if (lruKey) cache.delete(lruKey);
  }

  const key = makeCacheKey(query, documentFilter);
  cache.set(key, {
    sources,
    llmResponse,
    documentFilter,
    lastAccessed: Date.now(),
    hitCount: 0,
  });
}

export function invalidateCacheForDocument(documentFilter: string): void {
  for (const [key] of cache.entries()) {
    if (key.includes(documentFilter)) {
      cache.delete(key);
    }
  }
}
