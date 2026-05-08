"""
DocRAFT Backend — FastAPI Application
Enterprise-Grade RAFT (Retrieval-Augmented Fine-Tuning) Agent API.
"""

import os
import logging
import sys
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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


# ── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"DocRAFT API starting up (env={ENVIRONMENT})")
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
    allow_origins=[FRONTEND_ORIGIN],
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
