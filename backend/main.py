"""
DocRAFT Backend — FastAPI Application
Enterprise-Grade RAFT (Retrieval-Augmented Fine-Tuning) Agent API.
"""

import os
import logging
import sys
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Dict

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

# Import our custom pipeline, embedder, and reranker
from ingestion.pipeline import run_ingestion
from ingestion.embedder import DocRAFTEmbedder
from retrieval.reranker import DocRAFTReranker
from cache.semantic_cache import SemanticCache
from retrieval.agent import run_rag_agent

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

# Global placeholders for clients (initialized in lifespan)
qdrant_client: QdrantClient | None = None
ollama_client: OllamaClient | None = None
doc_embedder: DocRAFTEmbedder | None = None
doc_reranker: DocRAFTReranker | None = None
semantic_cache: SemanticCache = SemanticCache()


# ── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global qdrant_client, ollama_client, doc_embedder, doc_reranker
    logger.info(f"DocRAFT API starting up (env={ENVIRONMENT})")
    
    # 1. Initialize Qdrant/Ollama (Fast)
    try:
        ollama_client = OllamaClient(host=OLLAMA_HOST)
        
        if ENVIRONMENT == "development" and QDRANT_HOST in ["localhost", "127.0.0.1"]:
            logger.info("Using Local Disk Mode for Qdrant")
            qdrant_client = QdrantClient(path="local_qdrant")
        else:
            qdrant_client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
        logger.info("✓ Core clients initialized successfully.")
    except Exception as e:
        logger.error(f"CRITICAL: Failed to initialize clients: {e}")

    # 1.5 Initialize ML components (Pre-load models before serving)
    try:
        doc_embedder = DocRAFTEmbedder()
        if os.getenv("ENABLE_RERANKER", "false").lower() == "true":
            doc_reranker = DocRAFTReranker()
        else:
            logger.info("Reranker is disabled (ENABLE_RERANKER=false). Skipping startup pre-load to speed up reload times.")
            doc_reranker = None
    except Exception as e:
        logger.error(f"CRITICAL: Failed to load ML models during startup: {e}")

    # 2. Collection Setup (Dynamic Dimensions)
    try:
        if qdrant_client:
            # Dynamically fetch the embedding model dimension to prevent mismatches
            vector_size = doc_embedder.vector_size if doc_embedder else 1024
            if qdrant_client.collection_exists(collection_name=COLLECTION_NAME):
                info = qdrant_client.get_collection(collection_name=COLLECTION_NAME)
                current_params = info.config.params.vectors
                # Handle different qdrant versions of response
                current_dim = getattr(current_params, 'size', None) or current_params.get('size')
                
                if current_dim != vector_size:
                    logger.warning(f"Dimension mismatch (DB={current_dim}, App={vector_size}). Recreating...")
                    qdrant_client.delete_collection(collection_name=COLLECTION_NAME)
                    qdrant_client.create_collection(
                        collection_name=COLLECTION_NAME,
                        vectors_config=qdrant_models.VectorParams(size=vector_size, distance=qdrant_models.Distance.COSINE),
                    )
            else:
                qdrant_client.create_collection(
                    collection_name=COLLECTION_NAME,
                    vectors_config=qdrant_models.VectorParams(size=vector_size, distance=qdrant_models.Distance.COSINE),
                )
                qdrant_client.create_payload_index(
                    collection_name=COLLECTION_NAME,
                    field_name="source_document",
                    field_schema=qdrant_models.PayloadSchemaType.KEYWORD,
                )
                logger.info(f"Collection {COLLECTION_NAME} created.")
            
            # Always ensure the payload index for source_document exists to optimize metadata-filtered searches
            qdrant_client.create_payload_index(
                collection_name=COLLECTION_NAME,
                field_name="source_document",
                field_schema=qdrant_models.PayloadSchemaType.KEYWORD,
            )
            logger.info("✓ Qdrant collection ready and indexed.")
    except Exception as e:
        logger.error(f"Failed to setup collection: {e}")

    yield
    
    # 3. Shutdown
    logger.info("DocRAFT API shutting down...")
    if qdrant_client:
        qdrant_client.close()


# ── Utilities ────────────────────────────────────────────────────────────────
def get_embedder():
    """Lazy-load the embedder to prevent startup blocking."""
    global doc_embedder
    if doc_embedder is None:
        logger.info("Loading embedding model (BGE-Large)... this may take a moment.")
        doc_embedder = DocRAFTEmbedder()
    return doc_embedder

def get_reranker():
    """Lazy-load the reranker to prevent startup blocking."""
    global doc_reranker
    if doc_reranker is None:
        logger.info("Loading reranker model (BGE-Reranker)... this may take a moment.")
        doc_reranker = DocRAFTReranker()
    return doc_reranker
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
    expose_headers=["X-Sources"],
)

# ── Static file serving for extracted images ─────────────────────────────────
IMAGES_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "images")
os.makedirs(IMAGES_DIR, exist_ok=True)
app.mount("/images", StaticFiles(directory=IMAGES_DIR), name="images")


# ── Schemas ──────────────────────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str
    environment: str
    timestamp: str
    version: str

class QueryRequest(BaseModel):
    query: str
    limit: int = 5
    document_filter: list[str] | None = None
    rerank: bool = True  # Enable two-pass retrieval by default

class QueryResponse(BaseModel):
    results: list

class AgentChatRequest(BaseModel):
    query: str
    messages: list[dict] = []
    document_filter: list[str] | None = None

class AgentChatResponse(BaseModel):
    response: str
    sources: list

# In-memory dictionary to track background task statuses
task_status: Dict[str, dict] = {}

def process_document_bg(task_id: str, tmp_path: str, original_filename: str, client: QdrantClient):
    """Background task to run the heavy multimodal ingestion pipeline."""
    task_status[task_id] = {"status": "processing", "filename": original_filename, "message": "Starting pipeline..."}
    try:
        logger.info(f"Background task {task_id} started for: {original_filename}")
        result = run_ingestion(pdf_file=tmp_path, qdrant_client=client, original_filename=original_filename)
        
        if result.get("status") == "success":
            task_status[task_id] = {
                "status": "completed",
                "filename": original_filename,
                "chunks_created": result.get("total_chunks", 0),
                "message": "Multimodal ingestion complete."
            }
            # Clear semantic cache to prevent stale global retrieval hits
            semantic_cache.clear_sync()
        else:
            task_status[task_id] = {
                "status": "failed",
                "filename": original_filename,
                "message": result.get("reason", "Unknown pipeline error")
            }
    except Exception as e:
        logger.error(f"Task {task_id} failed: {traceback.format_exc()}")
        task_status[task_id] = {"status": "failed", "filename": original_filename, "message": str(e)}
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


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
async def upload_document(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Accepts a PDF, starts the Multimodal Ingestion Pipeline in the background, and returns a Task ID."""
    try:
        # Generate a unique task ID
        task_id = str(uuid.uuid4())
        
        # Save uploaded file to a temporary file
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
        tmp.write(await file.read())
        tmp.close()

        # Check if database is connected
        if not qdrant_client:
            raise Exception("Database is not connected. Please check if another instance of DocRAFT is running and locking the storage.")
        
        logger.info(f"Triggering background multimodal ingestion for: {file.filename}")
        
        # Add the heavy lifting to the background queue
        background_tasks.add_task(
            process_document_bg, 
            task_id, 
            tmp.name, 
            file.filename, 
            qdrant_client
        )
        
        # Set initial status
        task_status[task_id] = {"status": "queued", "filename": file.filename}
        
        # Clear the entire cache to prevent any stale global cache hits
        await semantic_cache.clear()
        
        # Return immediately!
        return {"task_id": task_id, "status": "queued", "message": "Document ingestion started in background."}

    except Exception as e:
        logger.error(f"Upload failed: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status/{task_id}", tags=["Documents"])
async def get_task_status(task_id: str):
    """Check the status of a background ingestion task."""
    if task_id not in task_status:
        raise HTTPException(status_code=404, detail="Task not found")
    return task_status[task_id]



@app.post("/query", response_model=QueryResponse, tags=["Retrieval"])
async def query_documents(request: QueryRequest):
    """Queries the vector database using semantic search with optional reranking."""
    try:
        if not qdrant_client:
            raise HTTPException(status_code=503, detail="Database is not connected.")
        
        embedder = get_embedder()
        logger.info(f"[Query] Using embedder: {embedder.model_name} (dim={embedder.vector_size})")
        query_vector = embedder.embed_query(request.query)
        
        # ── Cache lookup ─────────────────────────────────────────────────
        cached_results = await semantic_cache.lookup(
            query_embedding=query_vector,
            document_filter=request.document_filter,
        )
        if cached_results is not None:
            logger.info("[Cache] HIT — returning cached results instantly.")
            return QueryResponse(results=cached_results)
        logger.info("[Cache] MISS — running full retrieval pipeline.")
        # ─────────────────────────────────────────────────────────────────
        
        # Build optional document filter
        query_filter = None
        if request.document_filter:
            # Handle both single string and list for backward compatibility just in case
            if isinstance(request.document_filter, str):
                match_val = qdrant_models.MatchValue(value=request.document_filter)
            else:
                match_val = qdrant_models.MatchAny(any=request.document_filter)
            query_filter = qdrant_models.Filter(
                must=[
                    qdrant_models.FieldCondition(
                        key="source_document",
                        match=match_val
                    )
                ]
            )
        
        from ingestion.config import RETRIEVAL_CANDIDATE_K
        
        # Pass 1: Broad vector retrieval
        candidate_limit = RETRIEVAL_CANDIDATE_K if request.rerank else request.limit
        search_result = qdrant_client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            query_filter=query_filter,
            limit=candidate_limit
        ).points
        
        # Pass 2: Cross-encoder reranking (if enabled)
        if request.rerank and len(search_result) > 0:
            reranker = get_reranker()
            texts = [hit.payload.get("text", "") for hit in search_result]
            
            # Rerank passages
            reranked = reranker.rerank(request.query, texts, top_n=request.limit)
            
            results = []
            for orig_idx, rerank_score in reranked:
                hit = search_result[orig_idx]
                results.append({
                    "id": hit.id,
                    "score": round(rerank_score, 4),
                    "vector_score": round(hit.score, 4),
                    "text": hit.payload.get("text"),
                    "display_text": hit.payload.get("display_text"),
                    "filename": hit.payload.get("filename") or hit.payload.get("source_file") or hit.payload.get("source_document"),
                    "source_document": hit.payload.get("source_document") or hit.payload.get("filename") or hit.payload.get("source_file"),
                    "image_path": hit.payload.get("image_path"),
                    "content_type": hit.payload.get("content_type", "text"),
                    "reranked": True
                })
        else:
            # Single-pass fallback
            results = [
                {
                    "id": hit.id,
                    "score": hit.score,
                    "vector_score": hit.score,
                    "text": hit.payload.get("text"),
                    "display_text": hit.payload.get("display_text"),
                    "filename": hit.payload.get("filename") or hit.payload.get("source_file") or hit.payload.get("source_document"),
                    "source_document": hit.payload.get("source_document") or hit.payload.get("filename") or hit.payload.get("source_file"),
                    "image_path": hit.payload.get("image_path"),
                    "content_type": hit.payload.get("content_type", "text"),
                    "reranked": False
                }
                for hit in search_result
            ]
        
        # Store in semantic cache for future similar queries
        await semantic_cache.store(
            query_embedding=query_vector,
            document_filter=request.document_filter,
            results=results,
        )
        return QueryResponse(results=results)
    except Exception as e:
        logger.error(f"Query failed: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/agent/chat", response_model=AgentChatResponse, tags=["Retrieval"])
async def agent_chat(request: AgentChatRequest):
    """Executes the stateful Critic-Generator LangGraph loop for RAG query processing."""
    try:
        if not qdrant_client:
            raise HTTPException(status_code=503, detail="Database is not connected.")
        logger.info(f"[Agent Chat] Initiating Agentic loop for query: {request.query}")
        result = run_rag_agent(
            query=request.query,
            messages=request.messages,
            document_filter=request.document_filter
        )
        return AgentChatResponse(
            response=result["response"],
            sources=result["sources"]
        )
    except Exception as e:
        logger.error(f"Agent chat execution failed: {traceback.format_exc()}")
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
        
        seen = set()
        docs = []
        for point in scroll_result:
            filename = (
                point.payload.get("source_document")
                or point.payload.get("filename")
                or point.payload.get("source_file")
                or "unknown"
            )
            if filename not in seen:
                seen.add(filename)
                docs.append({
                    "id": point.id,
                    "filename": filename,
                    "source_document": filename,
                    "content_preview": point.payload.get("text", "")[:100] + "..." if point.payload.get("text") else ""
                })
        
        return {"documents": docs}
    except Exception as e:
        logger.error(f"List documents failed: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/cache/stats", tags=["System"])
async def cache_stats():
    """Returns current semantic cache size and entry count."""
    return {
        "entries": semantic_cache.size,
        "max_entries": 100,
        "similarity_threshold": 0.92,
    }

@app.post("/cache/clear", tags=["System"])
async def clear_cache():
    """Manually clears the entire semantic cache."""
    await semantic_cache.clear()
    return {"message": "Cache cleared."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
