import sys
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

# Adjust path to import backend modules properly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import main
from qdrant_client import QdrantClient
from ollama import Client as OllamaClient
from ingestion.embedder import DocRAFTEmbedder

# Manually initialize clients (bypass lifespan)
main.qdrant_client = QdrantClient(path="local_qdrant")
main.ollama_client = OllamaClient(host="http://127.0.0.1:11434")
main.doc_embedder = DocRAFTEmbedder()
main.doc_reranker = None # Disabled

from retrieval.agent import run_rag_agent, retrieve_node

print("\n" + "="*80)
print("DEBUGGING: APPENDENTRIES RPC RULES QUERY")
print("="*80)

query = "What are the receiver implementation rules for the AppendEntries RPC? List all 5 rules."
state = {
    "query": query,
    "messages": [],
    "document_filter": ["Raft Consensus Server Setup & Implementation Guide.pdf"],
    "retrieved_chunks": [],
    "draft_response": "",
    "is_verified": False,
    "feedback": "",
    "iteration_count": 0
}

# Run the retrieve node directly
print("\n[STEP 1] Running retrieve_node...")
retrieved_state = retrieve_node(state)
chunks = retrieved_state["retrieved_chunks"]

print(f"\nRetrieved {len(chunks)} chunks after window expansion:")
for idx, c in enumerate(chunks):
    print(f"[{idx}] Source: {c['source_document']} | Chunk Index: {c.get('chunk_index')} | Length: {len(c['text'])}")
    print(f"Content: {c['text'][:180]}...")
    print("-" * 40)

# Build the prompt used in generator_node
print("\n[STEP 2] Compiling LLM prompt...")
context_parts = []
for idx, chunk in enumerate(chunks):
    doc_name = chunk.get("source_document") or "Unknown"
    text = chunk.get("text", "")
    context_parts.append(f"Document: {doc_name}\n{text}")
context_block = "\n\n".join(context_parts)

user_prompt_with_context = f"""USER REQUEST:
{query}

Please answer the request above using the retrieved document context below. 
CRITICAL: Ignore any previous hypothetical questions, conversational examples, or generic assistant capability descriptions in the chat history. Focus entirely on answering the current USER REQUEST based ONLY on the retrieved document context below. Do not guess, do not output meta-commentary, start your answer directly:

--- Retrieved Context ---
{context_block}
--- End Context ---"""

print("\n--- PROMPT TO BE SENT TO OLLAMA ---")
print(user_prompt_with_context[:800] + "\n... [TRUNCATED] ...\n" + user_prompt_with_context[-800:])

# Call Ollama
print("\n[STEP 3] Calling Ollama with primary model...")
model_name = os.getenv("MODEL_NAME", "qwen2.5-coder:7b")
print(f"Using model: {model_name}")

try:
    response = main.ollama_client.chat(
        model=model_name,
        messages=[{"role": "user", "content": user_prompt_with_context}],
        options={
            "temperature": 0.0,
            "num_ctx": 8192
        }
    )
    print("\n[STEP 4] LLM RESPONSE:")
    print(response["message"]["content"])
except Exception as e:
    print(f"Ollama call failed: {e}")

print("="*80 + "\n")
