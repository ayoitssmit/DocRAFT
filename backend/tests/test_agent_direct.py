import sys
import os

# Adjust path to import backend modules properly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

print("[Direct Test] Initializing modules and clients...")
import main
from qdrant_client import QdrantClient
from ollama import Client as OllamaClient
from ingestion.embedder import DocRAFTEmbedder
from retrieval.reranker import DocRAFTReranker

# Initialize the main module globals manually to bypass FastAPI startup lifespan
main.qdrant_client = QdrantClient(path="local_qdrant")
main.ollama_client = OllamaClient(host="http://127.0.0.1:11434")
print("[Direct Test] Loading Embedder model...")
main.doc_embedder = DocRAFTEmbedder()
print("[Direct Test] Loading Reranker model...")
main.doc_reranker = DocRAFTReranker()
print("[Direct Test] All clients ready!")

from retrieval.agent import run_rag_agent

# Run TC-001 directly
query = "What are the specific persistent and volatile state variables a Raft server must maintain according to the guide?"
print(f"\n[Direct Test] Executing query: '{query}'")

try:
    result = run_rag_agent(
        query=query,
        messages=[],
        document_filter=["Raft Consensus Server Setup & Implementation Guide.pdf"]
    )
    print("\n[Direct Test] SUCCESSFUL RESPONSE:")
    print(result["response"])
except KeyboardInterrupt:
    print("\n[Direct Test] Interrupted by user!")
except Exception as e:
    print(f"\n[Direct Test] FAILED: {e}")
