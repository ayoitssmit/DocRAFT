from qdrant_client import QdrantClient

client = QdrantClient(path="local_qdrant")
collection_name = "docraft_knowledge"

print("=" * 80)
print(f"Inspecting Qdrant collection: {collection_name}")
print("=" * 80)

if not client.collection_exists(collection_name):
    print(f"Collection '{collection_name}' does not exist!")
    exit(1)

info = client.get_collection(collection_name)
print(f"Total Vectors/Points in DB: {info.points_count}")

scroll_result, _ = client.scroll(
    collection_name=collection_name,
    limit=100,
    with_payload=True,
    with_vectors=False
)

print(f"Scrolled {len(scroll_result)} points:")
docs_by_source = {}
for p in scroll_result:
    source = p.payload.get("source_document") or p.payload.get("filename") or "unknown"
    if source not in docs_by_source:
        docs_by_source[source] = []
    docs_by_source[source].append(p)

for source, points in docs_by_source.items():
    print(f"\nDocument: {source}")
    print(f"Number of chunks: {len(points)}")
    print("Preview of first chunk:")
    first_p = sorted(points, key=lambda x: x.payload.get("chunk_index", 0))[0]
    text_preview = first_p.payload.get("text", "")[:300].replace('\n', ' ')
    print(f"  [Chunk {first_p.payload.get('chunk_index')}] {text_preview}...")
print("=" * 80)
