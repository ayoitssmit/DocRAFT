"""
Ingestion test for DocRAFT.
Demonstrates embedding generation via Ollama and storage in Qdrant.
"""

import logging
import sys
import os
import json
from pathlib import Path
from dotenv import load_dotenv
from ollama import Client
from qdrant_client import QdrantClient
from qdrant_client.http import models

# Environment Setup
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s]: %(message)s")
logger = logging.getLogger(__name__)

# Config
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))
COLLECTION_NAME = "docraft_knowledge"

def run_ingestion_test():
    ollama_client = Client(host=OLLAMA_HOST)
    qdrant_client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)

    # 1. Load Data
    data_path = Path(__file__).parent.parent.parent / 'data' / 'sample_docs.json'
    with open(data_path, 'r') as f:
        documents = json.load(f)

    # 2. Get Embedding Dimensions (Auto-detect)
    logger.info(f"Detecting embedding dimensions for {EMBED_MODEL}...")
    sample_embed = ollama_client.embeddings(model=EMBED_MODEL, prompt="test")['embedding']
    vector_size = len(sample_embed)
    logger.info(f"Vector size: {vector_size}")

    # 3. Initialize Collection
    logger.info(f"Initializing collection: {COLLECTION_NAME}")
    if qdrant_client.collection_exists(collection_name=COLLECTION_NAME):
        qdrant_client.delete_collection(collection_name=COLLECTION_NAME)
        
    qdrant_client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=models.VectorParams(size=vector_size, distance=models.Distance.COSINE),
    )

    # 4. Generate Embeddings & Upsert
    logger.info("Generating embeddings and upserting points...")
    points = []
    for doc in documents:
        response = ollama_client.embeddings(model=EMBED_MODEL, prompt=doc['text'])
        embedding = response['embedding']
        
        points.append(models.PointStruct(
            id=doc['id'],
            vector=embedding,
            payload={"text": doc['text'], **doc['metadata']}
        ))

    qdrant_client.upsert(collection_name=COLLECTION_NAME, points=points)
    logger.info(f"Successfully upserted {len(points)} documents.")

    # 5. Test Retrieval
    query = "What database are we using for vectors?"
    logger.info(f"Testing retrieval with query: '{query}'")
    
    query_vector = ollama_client.embeddings(model=EMBED_MODEL, prompt=query)['embedding']
    search_result = qdrant_client.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        limit=1
    )

    if search_result:
        top_hit = search_result[0]
        logger.info(f"Top Hit (Score: {top_hit.score:.4f}): {top_hit.payload['text']}")
        logger.info("Ingestion and Retrieval test successful!")
    else:
        logger.error("No results found.")

if __name__ == "__main__":
    run_ingestion_test()
