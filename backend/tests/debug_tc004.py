import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import main
from qdrant_client import QdrantClient
from ollama import Client as OllamaClient
from ingestion.embedder import DocRAFTEmbedder
from retrieval.reranker import DocRAFTReranker

main.qdrant_client = QdrantClient(path="local_qdrant")
main.ollama_client = OllamaClient(host="http://127.0.0.1:11434")
main.doc_embedder = DocRAFTEmbedder()
main.doc_reranker = DocRAFTReranker()

from retrieval.agent import run_rag_agent

query = "Describe the step-by-step actions a Raft candidate must take when starting an election, including the transition rules."
print("\n" + "="*80)
print(f"DEBUGGING TC-004: {query}")
print("="*80)

# Run retrieval part
from retrieval.agent import get_qdrant, get_embedder, get_reranker, check_is_code_request
import os

qdrant = get_qdrant()
embedder = get_embedder()
reranker = get_reranker()

query_vector = embedder.embed_query(query)
from qdrant_client.http import models as qdrant_models
query_filter = qdrant_models.Filter(
    must=[
        qdrant_models.FieldCondition(
            key="source_document",
            match=qdrant_models.MatchValue(value="Raft Consensus Server Setup & Implementation Guide.pdf")
        )
    ]
)

search_result = qdrant.query_points(
    collection_name="docraft_knowledge",
    query=query_vector,
    query_filter=query_filter,
    limit=15,
).points

print(f"\n[Retriever] Retrieved {len(search_result)} raw candidates.")
texts = [hit.payload.get("text", "") for hit in search_result]
reranked = reranker.rerank(query, texts, top_n=5)

print("\n[Reranker] Top 5 Passages after Reranking:")
for i, (orig_idx, score) in enumerate(reranked):
    hit = search_result[orig_idx]
    print(f"\n--- Passage {i+1} (Score: {score:.4f}) ---")
    print(hit.payload.get("text"))

# Now run generator node
from retrieval.agent import generator_node, critic_node, refinement_node
state = {
    "query": query,
    "messages": [],
    "retrieved_chunks": [
        {
            "id": search_result[idx].id,
            "score": score,
            "text": search_result[idx].payload.get("text", ""),
            "display_text": search_result[idx].payload.get("display_text", ""),
            "source_document": "Raft Consensus Server Setup & Implementation Guide.pdf"
        }
        for idx, score in reranked
    ],
    "iteration_count": 0
}

gen_res = generator_node(state)
print("\n" + "="*80)
print("GENERATOR NODE RESPONSE:")
print("="*80)
print(gen_res["draft_response"])

state["draft_response"] = gen_res["draft_response"]
state["iteration_count"] = gen_res["iteration_count"]

critic_res = critic_node(state)
print("\n" + "="*80)
print("CRITIC NODE RESPONSE:")
print("="*80)
print(f"is_verified: {critic_res['is_verified']}")
print(f"feedback: {critic_res['critic_feedback']}")

state["is_verified"] = critic_res["is_verified"]
state["critic_feedback"] = critic_res["critic_feedback"]

if not state["is_verified"]:
    refine_res = refinement_node(state)
    print("\n" + "="*80)
    print("REFINER NODE RESPONSE:")
    print("="*80)
    print(refine_res["draft_response"])
