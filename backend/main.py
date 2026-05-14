"""
DocRAFT Backend — FastAPI Application
Enterprise-Grade RAFT (Retrieval-Augmented Fine-Tuning) Agent API.
"""

import os
import logging
import sys
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ollama import Client as OllamaClient
from qdrant_client import QdrantClient
from qdrant_client.http import models as qdrant_models
import uuid
import traceback
import tempfile
import os

from docling.document_converter import DocumentConverter
from llama_index.core import Document
from llama_index.core.node_parser import MarkdownNodeParser

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("docraft")

# ── Configuration ────────────────────────────────────────────────────────────
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
# Use 127.0.0.1 for local host reliability
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
QDRANT_HOST = os.getenv("QDRANT_HOST", "127.0.0.1")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))
COLLECTION_NAME = "docraft_knowledge"

try:
    ollama_client = OllamaClient(host=OLLAMA_HOST)
    
    # Use local mode if in development and not forced to use host
    if ENVIRONMENT == "development" and QDRANT_HOST in ["localhost", "127.0.0.1"]:
        logger.info("Using Local Disk Mode for Qdrant")
        qdrant_client = QdrantClient(path="local_qdrant")
    else:
        qdrant_client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
except Exception as e:
    logger.error(f"Failed to initialize clients: {e}")

# Import our custom pipeline AFTER basic config
from ingestion.pipeline import run_ingestion


# ── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"DocRAFT API starting up (env={ENVIRONMENT})")
    
    try:
        if not qdrant_client.collection_exists(collection_name=COLLECTION_NAME):
            logger.info(f"Initializing collection: {COLLECTION_NAME}")
            sample_embed = ollama_client.embeddings(model=EMBED_MODEL, prompt="test")['embedding']
            vector_size = len(sample_embed)
            qdrant_client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=qdrant_models.VectorParams(size=vector_size, distance=qdrant_models.Distance.COSINE),
            )
            logger.info(f"Collection {COLLECTION_NAME} created successfully.")
    except Exception as e:
        logger.error(f"Could not initialize Qdrant collection: {e}")

    yield
    logger.info("DocRAFT API shutting down")


# ── App Factory ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="DocRAFT API",
    description="Enterprise-Grade RAFT Agent — backend API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow the Next.js frontend in dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ──────────────────────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str
    environment: str
    timestamp: str
    version: str

class QueryRequest(BaseModel):
    query: str
    limit: int = 5

class QueryResponse(BaseModel):
    results: list


# ── Routes ───────────────────────────────────────────────────────────────────
@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """
    Liveness / readiness probe.
    Returns the service status, environment, and current timestamp.
    """
    return HealthResponse(
        status="healthy",
        environment=ENVIRONMENT,
        timestamp=datetime.now(timezone.utc).isoformat(),
        version=app.version,
    )


@app.get("/", tags=["System"])
async def root():
    return {
        "service": "DocRAFT API",
        "version": app.version,
        "docs": "/docs",
    }


@app.post("/upload", tags=["Documents"])
async def upload_document(file: UploadFile = File(...)):
    """Uploads a PDF and processes it using the advanced Multimodal Ingestion Pipeline."""
    try:
        # Create temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name
        
        # Trigger our advanced pipeline!
        logger.info(f"Triggering multimodal ingestion for: {file.filename}")
        result = run_ingestion(pdf_file=tmp_path, qdrant_client=qdrant_client)
        
        # Clean up temp file
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
            
        if result.get("status") == "success":
            return {
                "status": "success", 
                "chunks_created": result.get("total_chunks", 0), 
                "filename": file.filename,
                "message": "Multimodal ingestion complete (Images + OCR + Text)"
            }
        else:
            raise Exception(result.get("reason", "Unknown pipeline error"))

    except Exception as e:
        logger.error(f"Upload failed: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query", response_model=QueryResponse, tags=["Retrieval"])
async def query_documents(request: QueryRequest):
    """Queries the vector database using semantic search."""
    try:
        query_vector = ollama_client.embeddings(model=EMBED_MODEL, prompt=request.query)['embedding']
        
        search_result = qdrant_client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            limit=request.limit
        ).points
        
        results = [
            {
                "id": hit.id,
                "score": hit.score,
                "text": hit.payload.get("text"),
                "filename": hit.payload.get("filename")
            }
            for hit in search_result
        ]
        
        return QueryResponse(results=results)
    except Exception as e:
        logger.error(f"Query failed: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/documents", tags=["Documents"])
async def list_documents():
    """Lists all uploaded documents."""
    try:
        scroll_result, _ = qdrant_client.scroll(
            collection_name=COLLECTION_NAME,
            limit=100,
            with_payload=True,
            with_vectors=False
        )
        
        docs = [
            {
                "id": point.id,
                "filename": point.payload.get("filename", "unknown"),
                "content_preview": point.payload.get("text", "")[:100] + "..." if point.payload.get("text") else ""
            }
            for point in scroll_result
        ]
        
        return {"documents": docs}
    except Exception as e:
        logger.error(f"List documents failed: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))
