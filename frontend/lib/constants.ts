export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export const MODEL_NAME = process.env.MODEL_NAME ?? "ulysses";
// Active model in the backend: BAAI/bge-large-en (1024-dim) with nomic-embed-text as dynamic fallback
export const EMBED_MODEL = "BAAI/bge-large-en";
export const COLLECTION_NAME = "docraft_knowledge";
export const OLLAMA_HOST = "http://127.0.0.1:11434";
