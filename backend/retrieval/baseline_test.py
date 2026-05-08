"""
Baseline inference and Vector DB test for local environment.
Ensures the backend can successfully communicate with both Ollama and Qdrant.
"""

import logging
import sys
import os
from pathlib import Path
from dotenv import load_dotenv
from ollama import Client, ResponseError
from qdrant_client import QdrantClient
from qdrant_client.http.exceptions import UnexpectedResponse

# Load environment variables from .env file
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Configure enterprise-grade logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# Config
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
MODEL_NAME = os.getenv("MODEL_NAME", "qwen2.5-coder:7b")
QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))

def test_ollama_connection() -> bool:
    """Tests Ollama inference connection."""
    logger.info(f"--- Testing Ollama connection ({OLLAMA_HOST}) ---")
    client = Client(host=OLLAMA_HOST)
    try:
        response = client.generate(model=MODEL_NAME, prompt="Status check.")
        logger.info(f"Ollama/LLM Response: {response.get('response', '').strip()}")
        return True
    except Exception as e:
        logger.error(f"Ollama failure: {e}")
        return False

def test_qdrant_connection() -> bool:
    """Tests Qdrant connection and basic collection operations."""
    logger.info(f"--- Testing Qdrant connection ({QDRANT_HOST}:{QDRANT_PORT}) ---")
    client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
    test_collection = "baseline_health_check"
    
    try:
        # Check connection by listing collections
        collections = client.get_collections()
        logger.info(f"Connected to Qdrant. Existing collections: {len(collections.collections)}")
        
        # Test write capability
        logger.info(f"Verifying write access by creating collection: {test_collection}")
        if client.collection_exists(collection_name=test_collection):
            client.delete_collection(collection_name=test_collection)
            
        client.create_collection(
            collection_name=test_collection,
            vectors_config={"size": 4, "distance": "Dot"}, 
        )
        logger.info("Collection created successfully.")
        
        # Clean up
        client.delete_collection(collection_name=test_collection)
        logger.info("Collection deleted successfully (Clean up).")
        return True
    except Exception as e:
        logger.error(f"Qdrant failure: {e}")
        return False

if __name__ == "__main__":
    logger.info("Starting Full Environment Baseline Test")
    
    ollama_ok = test_ollama_connection()
    qdrant_ok = test_qdrant_connection()
    
    if ollama_ok and qdrant_ok:
        logger.info("CONCLUSION: Environment setup is VALID and operational.")
        sys.exit(0)
    else:
        logger.error("CONCLUSION: Environment setup is INCOMPLETE.")
        sys.exit(1)
