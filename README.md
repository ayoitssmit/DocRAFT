# DocRAFT

> **Enterprise-Grade Retrieval-Augmented Fine-Tuning Agent**  
> Intelligent document processing, multimodal knowledge extraction, and semantic search at scale — powered by Docling, LlamaIndex, Qdrant, and Ollama.

---

## Table of Contents

- [Overview](#overview)
- [Technical Highlights](#technical-highlights)
- [Architecture & Pipeline](#architecture--pipeline)
- [Prerequisites](#prerequisites)
- [AI Model Setup](#ai-model-setup)
- [Installation](#installation)
- [Running the System](#running-the-system)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Performance Notes](#performance-notes)
- [Authors](#authors)

---

## Overview

DocRAFT is an enterprise-grade **Retrieval-Augmented Generation (RAG)** system designed for high-fidelity document ingestion and intelligent semantic search. It combines layout-aware PDF parsing, vision-based diagram analysis, OCR-augmented text extraction, and dense vector embeddings into a unified, queryable knowledge base — all running locally on your own hardware.

Unlike naive document chunking systems that split by character count, DocRAFT performs **heading-aware semantic chunking** via LlamaIndex, preserving document structure and enabling precise, context-aware retrieval. A 50-page technical document is transformed into 30–50 individually searchable semantic units, each carrying rich metadata.

---

## Technical Highlights

| Capability | Technology |
|---|---|
| Layout-aware PDF parsing | Docling `DocumentConverter` |
| Semantic chunking | LlamaIndex `MarkdownNodeParser` |
| Dense vector embeddings | Ollama `nomic-embed-text` (768-dim) |
| Vector storage & retrieval | Qdrant (local disk or Docker) |
| Vision / diagram analysis | Ollama `granite3.2-vision:2b` |
| OCR for technical labels | RapidOCR |
| LLM reasoning | Ollama `qwen2.5-coder:7b` |
| API layer | FastAPI + Uvicorn |
| Frontend | Next.js 16 + Tailwind CSS 4 |
| GPU acceleration | CUDA 12.4 via PyTorch |

**Key design principles:**

- **Multimodal Ingestion** — Extracts text, tables, figures, and embedded diagrams from PDFs with high structural fidelity.
- **Vision Intelligence** — Automatically describes architectural diagrams and charts using Ollama Vision models, making visual content searchable.
- **OCR-Augmented Retrieval** — RapidOCR extracts technical labels and annotations from image regions, enriching the knowledge base beyond raw PDF text.
- **Local-First Architecture** — No external API calls. All inference, embedding, and storage runs on your own hardware via Ollama and local Qdrant.
- **GPU Accelerated** — Optimized for NVIDIA hardware with CUDA-enabled PyTorch for fast ingestion and vision inference.

---

## Architecture & Pipeline

DocRAFT implements a multi-stage ingestion and retrieval pipeline:

```
PDF Upload
    │
    ▼
┌─────────────────────────────────────┐
│        Docling DocumentConverter     │
│  Layout parsing · Table extraction  │
│  Image annotation · Structure map   │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│     LlamaIndex MarkdownNodeParser   │
│  Heading-aware chunking             │
│  → N semantic chunks with metadata  │
└─────────────────────────────────────┘
    │
    ├──► [If chunk contains image region]
    │         │
    │         ▼
    │    ┌──────────────────────────────┐
    │    │  RapidOCR + Granite Vision   │
    │    │  OCR labels · Diagram desc   │
    │    │  Caption enrichment          │
    │    └──────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│     Ollama nomic-embed-text          │
│  Each chunk → 768-dim dense vector  │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│         Qdrant Vector Database       │
│  Points stored with full payload    │
│  Local disk · Cosine similarity     │
└─────────────────────────────────────┘
    │
    ▼
/query endpoint
    │
    ├─ Question → nomic-embed-text → query vector
    ├─ Cosine similarity search → top-K chunks
    └─ Ranked results with scores returned
```

### Chunking Strategy

DocRAFT does **not** chunk by token count or character limit. The `MarkdownNodeParser` from LlamaIndex splits documents at semantic heading boundaries, preserving:

- Section context and hierarchy
- Table integrity (tables are not split mid-row)
- Figure-to-caption associations
- Cross-reference metadata

This means retrieval is structurally meaningful — a query about a specific subsystem will return the chunk corresponding to that section, not an arbitrary window of characters.

---

## Prerequisites

Before installing DocRAFT, ensure the following are available on your system:

1. **Python 3.12** — Required for compatibility with Docling and LlamaIndex. Other versions are not officially supported.
2. **NVIDIA GPU** — Strongly recommended. Vision AI inference (Granite 3.2) and Docling's layout model are significantly faster on GPU. CPU is supported but expect 5–10× slower ingestion for documents with images.
3. **Ollama** — Local LLM and embedding runtime. [Download from ollama.ai](https://ollama.ai/).
4. **Git** — For cloning the repository.
5. **Docker** *(optional)* — Required only for the Docker Compose deployment path.

---

## AI Model Setup

After installing Ollama, pull all three required models:

```powershell
# LLM for chat, reasoning, and code-related queries
ollama pull qwen2.5-coder:7b

# Embedding model — generates 768-dimensional vectors for all chunks
ollama pull nomic-embed-text

# Vision model — analyzes architectural diagrams and figures in PDFs
ollama pull granite3.2-vision:2b
```

> All three models must be available locally before starting the backend. The system will fail on startup if any model is missing from Ollama.

---

## Installation

### Step 1 — Clone the Repository

```powershell
git clone https://github.com/ayoitssmit/DocRAFT.git
cd DocRAFT
```

### Step 2 — Configure Environment

```powershell
cp infra/.env.example .env
```

Open `.env` and configure paths, model names, and Qdrant settings as needed for your environment.

### Step 3 — Install Python Dependencies

Choose the installation path that matches your hardware:

#### Option A: GPU (NVIDIA CUDA) — Recommended

```powershell
# Install all backend Python dependencies
pip install -r backend/requirements.txt

# Install CUDA-enabled PyTorch (CUDA 12.4)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
```

#### Option B: CPU (Universal)

```powershell
# Install all backend Python dependencies
pip install -r backend/requirements.txt

# Install standard PyTorch (CPU-only)
pip install torch torchvision torchaudio
```

> **Note:** Vision AI analysis (diagram extraction and OCR) runs 5–10× slower on CPU compared to GPU. For production or large document sets, NVIDIA GPU + CUDA is strongly recommended.

---

## Running the System

### Option A: Local Development (Recommended)

Runs the FastAPI backend in local-disk mode. Qdrant data is persisted to `local_qdrant/` on disk — no Docker required.

```powershell
cd backend
..\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

Once running:

- **Interactive API Docs (Swagger UI):** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc API Docs:** [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

### Option B: Docker Compose (Full Stack)

Starts the complete stack: FastAPI backend, Next.js frontend, and Qdrant vector database as containers.

```powershell
docker compose -f infra/docker-compose.yml up --build
```

| Service | Default URL |
|---|---|
| FastAPI Backend | `http://localhost:8000` |
| Next.js Frontend | `http://localhost:3000` |
| Qdrant Dashboard | `http://localhost:6333/dashboard` |

---

## API Reference

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness probe. Returns system status, used by the frontend status card. |
| `POST` | `/upload` | Accepts a PDF file and runs the full multimodal ingestion pipeline (Docling → chunking → OCR/Vision → embedding → Qdrant). |
| `POST` | `/query` | Embeds the input query and performs cosine similarity search against the vector database. Returns top-K ranked chunks with scores. |
| `GET` | `/documents` | Lists all stored document chunks currently indexed in the vector database. |

---

### `POST /upload`

Upload and ingest a PDF document.

**Request:** `multipart/form-data`

| Field | Type | Description |
|---|---|---|
| `file` | `File` | The PDF file to ingest. |

**Response:**

```json
{
  "status": "success",
  "document_id": "abc123",
  "chunks_created": 42,
  "pages_processed": 14
}
```

---

### `POST /query`

Perform a semantic search over the ingested knowledge base.

**Request:** `application/json`

```json
{
  "query": "Explain the system architecture",
  "limit": 3
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | Yes | The natural language question or search query. |
| `limit` | `integer` | No | Number of top results to return. Defaults to `5`. |

**Response:**

```json
{
  "results": [
    {
      "score": 0.921,
      "text": "...",
      "source_document": "architecture_overview.pdf",
      "chunk_id": "chunk_007",
      "metadata": { ... }
    }
  ]
}
```

**Example (cURL):**

```bash
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Explain the system architecture", "limit": 3}'
```

---

### `GET /documents`

Returns a list of all indexed document chunks stored in Qdrant.

**Response:**

```json
{
  "total": 84,
  "documents": [
    {
      "chunk_id": "chunk_001",
      "source_document": "design_spec.pdf",
      "preview": "This section describes..."
    }
  ]
}
```

---

## Project Structure

```
DocRAFT/
├── backend/
│   ├── main.py                  # FastAPI application entry point
│   ├── requirements.txt         # Python dependencies
│   ├── ingestion/               # Multimodal PDF processing pipeline
│   │   ├── docling_parser.py    # Docling-based layout parsing & Markdown conversion
│   │   ├── vision_analyzer.py   # Granite Vision model integration for diagrams
│   │   └── ocr_extractor.py     # RapidOCR for technical label extraction
│   └── retrieval/               # Search and RAG logic
│       ├── embedder.py          # nomic-embed-text embedding via Ollama
│       ├── vector_store.py      # Qdrant client & collection management
│       └── query_engine.py      # Semantic search and result ranking
│
├── frontend/                    # Next.js 16 + Tailwind CSS 4 application
│   ├── app/                     # App router pages and layouts
│   └── components/              # UI components (upload, search, results)
│
├── infra/
│   ├── docker-compose.yml       # Full-stack container orchestration
│   └── .env.example             # Environment variable template
│
├── data/
│   └── markdown/                # Enriched Markdown outputs (for debugging ingestion)
│
└── local_qdrant/                # Local vector database storage (auto-created)
```

---

## Performance Notes

| Scenario | Ingestion Speed | Notes |
|---|---|---|
| Text-only PDF (no images) | Fast | Docling parsing + embedding only |
| PDF with diagrams (GPU) | Moderate | Vision inference on GPU, ~2–5s per image |
| PDF with diagrams (CPU) | Slow | Vision inference 5–10× slower without CUDA |
| Large document (50+ pages) | ~30–50 chunks | Each chunk embedded and stored independently |

- Embedding is performed per-chunk using `nomic-embed-text` (768 dimensions) via Ollama.  
- Vector similarity search uses **cosine distance** in Qdrant.  
- Local Qdrant storage is persisted to `local_qdrant/` and survives backend restarts.  
- For large-scale deployments, switch to a networked Qdrant instance via Docker Compose.

---

## Authors

Built by **Smit Shah** & **Jalpan Vyas**

---

*DocRAFT — Local-first, multimodal, enterprise-ready RAG.*
