from qdrant_client import QdrantClient
from qdrant_client.http import models as qdrant_models

client = QdrantClient(path="local_qdrant")
collection_name = "docraft_knowledge"
doc_name = "Raft Consensus Server Setup & Implementation Guide.pdf"

print("=" * 80)
print(f"Printing chunks for: {doc_name}")
print("=" * 80)

if not client.collection_exists(collection_name):
    print("Collection does not exist!")
    exit(1)

scroll_filter = qdrant_models.Filter(
    must=[
        qdrant_models.FieldCondition(
            key="source_document",
            match=qdrant_models.MatchValue(value=doc_name)
        )
    ]
)

try:
    scroll_result, _ = client.scroll(
        collection_name=collection_name,
        scroll_filter=scroll_filter,
        limit=20,
        with_payload=True,
        with_vectors=False
    )
    
    if not scroll_result:
        print("No chunks found in database!")
        exit(0)
        
    sorted_points = sorted(
        scroll_result,
        key=lambda p: p.payload.get("chunk_index", 0) if p.payload else 0
    )
    
    print(f"Found {len(sorted_points)} chunks:")
    for point in sorted_points:
        idx = point.payload.get("chunk_index", "N/A")
        text = point.payload.get("text", "")
        print(f"\n=== CHUNK {idx} (Length: {len(text)}) ===")
        print(text)
        print("-" * 80)
except Exception as e:
    print(f"Error: {e}")
print("=" * 80)
