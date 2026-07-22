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

Unlike naive document chunking systems that split by character count, DocRAFT performs **heading-aware semantic chunking** via LlamaIndex, preserving document structure and enabling precise, context-aware retrieval. A 50-page technical document is transformed into 30–50 individually searchable semantic units, each carrying rich metadata including source filename, chunk index, page context, and content type.

PDF ingestion is handled **asynchronously** via FastAPI background tasks. When you upload a document, the API immediately returns a Task ID and the heavy pipeline runs in the background — so the frontend stays responsive even for large, image-heavy PDFs. Task status can be polled at any time via the `/status/{task_id}` endpoint.

---

## Technical Highlights

| Capability | Technology |
|---|---|
| LLM reasoning & coding | **[Ulysses](https://huggingface.co/jalpan04/Ulysses)** (Primary Fine-Tuned Qwen 2.5 Coder 7B) & **qwen2.5-coder:7b** (Inference/Coding Fallback) |
| Stateful Agentic Graph | **LangGraph** (`Retrieve ➔ Generate ➔ Critic ➔ Refine`) |
| Semantic query cache | **Custom in-memory async-safe cache** (LRU eviction policy) |
| Two-Pass Reranking | **BAAI/bge-reranker-v2-m3** (with BAAI/bge-reranker-base fallback, toggled in `.env`) |
| Layout-aware PDF parsing | Docling `DocumentConverter` (with CUDA GPU acceleration) |
| Vision / diagram analysis | Ollama `granite3.2-vision:2b` |
| Dense vector embeddings | **BAAI/bge-large-en** (Primary, 1024-dim, CPU) & **nomic-embed-text** (Fallback, 768-dim, Ollama) |
| Vector storage & retrieval | Qdrant (local disk or Docker) |
| Semantic chunking | LlamaIndex `MarkdownNodeParser` + `SentenceSplitter` (Optimized to **1500-char** limit) |
| OCR for technical labels | RapidOCR (ONNX runtime) |
| Mathematical typesetting | **KaTeX / rehype-katex / remark-math** (Full LaTeX support) |
| Async task processing | FastAPI `BackgroundTasks` |
| API layer | FastAPI + Uvicorn |
| Frontend | Next.js 16 + Tailwind CSS 4 |
| GPU acceleration | CUDA 12.4 via PyTorch |

**Key design principles & features:**

- **Stateful Agent Loop (LangGraph)** — Implements a stateful agent loop (`Retrieve ➔ Generate ➔ Critic ➔ Refine`) with `ulysses` as the primary model and `qwen2.5-coder:7b` as the fallback model for logic and code correction.
- **Completeness Guard & LaTeX Validation** — The Critic node runs a deterministic Python regex static analyzer that automatically audits code blocks and rejects them if they contain placeholder code (`pass`, `TODO`, `...`) or leaked LaTeX math delimiters (`$`, `$$`) in code blocks.
- **Async-Safe Semantic Cache** — In-memory query cache that stores embeddings, return values, and document scopes, returning instant **0ms** responses for semantically identical questions (similarity $\ge 0.92$), and automatically invalidates scopes when new document versions are uploaded.
- **Self-Healing Embedding Wrapper** — Automatically switches between `BAAI/bge-large-en` (1024-dim, CPU) and `nomic-embed-text` (768-dim, Ollama) on errors, dynamically scaling Qdrant vector shapes on the fly.
- **Hardware-Aware Load Balancing** — Runs LLM inference on the GPU while offloading embeddings and cross-encoder rerankers to the CPU to prevent CUDA OOM on standard 8GB laptop GPUs.
- **Multimodal Ingestion** — Extracts text, tables, figures, and embedded diagrams from PDFs with high structural fidelity.
- **Vision Intelligence** — Automatically describes architectural diagrams and charts using Ollama Vision models, making visual content searchable.
- **OCR-Augmented Retrieval & Smart Hiding** — RapidOCR extracts technical labels from image regions. To ensure clean visual presentation, these raw OCR dumps are wrapped in special `<!-- OCR_START -->` comments so the **AI model retains 100% accuracy** from the text inside images, while the **frontend dynamically filters them out** to keep source citation cards perfectly clean.
- **LaTeX Mathematical Typesetting** — Full KaTeX support inside both chat bubbles and document source preview cards. Features a robust preprocessor that normalizes raw PDF text formatting, bracket styles (e.g., `( \nabla_x ... )`, `[ ... ]`), and raw variables (e.g., `x T` $\rightarrow$ `$x_T$`, `λ` $\rightarrow$ `\lambda`) on the fly, eliminating compiler warnings.
- **Optimized 1500-Char Chunking** — Upgraded from 512 to 1500 characters (150 overlap). This optimal layout guarantees that complex technical tables, diagrams, and paragraphs remain whole and are never cut off in the middle of a row or sentence.
- **Base64 Sources Streaming** — Prevents character collision (e.g. arrow notation `-->` inside document text) by base64-encoding the retrieval sources prefix packet. The Next.js frontend safely decodes and renders this on the fly.
- **Non-Blocking State Updates** — Suspends background session auto-saves during active streaming to prevent state-cascade infinite loops, ensuring 100% stable, buttery-smooth text generation.
- **Non-Blocking Uploads** — The `/upload` endpoint returns immediately with a task ID. Ingestion runs in the background, allowing multiple documents to be queued without blocking the API.
- **Local-First Architecture** — No external API calls. All inference, embedding, and storage runs on your own hardware via Ollama and local Qdrant.
- **GPU Accelerated** — Optimized for NVIDIA hardware with CUDA-enabled PyTorch for fast ingestion and vision inference.

---

## Architecture & Pipeline

DocRAFT implements a multi-stage ingestion and retrieval pipeline:

```
PDF Upload (POST /upload)
    │
    ▼ Returns task_id immediately
┌─────────────────────────────────────┐
│     FastAPI BackgroundTasks Queue    │
│  Non-blocking · Async processing    │
└─────────────────────────────────────┘
    │
    ▼ (Background Worker)
┌─────────────────────────────────────┐
│        Docling DocumentConverter     │
│  Layout parsing · Table extraction  │
│  Image extraction · Structure map   │
│  OCR enabled (RapidOCR via ONNX)    │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│      Image Intelligence Layer        │
│  Pass 1: Save all images to disk    │
│  Pass 2 (per image):                │
│   ├─ RapidOCR → label text          │
│   └─ Granite Vision → AI caption    │
│  Inject descriptions into Markdown  │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│       Markdown Noise Cleaning        │
│  Remove Table of Contents           │
│  Remove List of Figures/Tables      │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│     LlamaIndex MarkdownNodeParser   │
│  Heading-aware primary chunking     │
│  SentenceSplitter sub-chunking      │
│  → N semantic chunks with metadata  │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│     Ollama nomic-embed-text          │
│  Each chunk → 768-dim dense vector  │
│  Image descriptions embedded too    │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│         Qdrant Vector Database       │
│  Points stored with full payload    │
│  Payload: text, filename, chunk     │
│  index, content_type, page_no       │
│  Local disk · Cosine similarity     │
└─────────────────────────────────────┘
    │
    ▼
/query endpoint
    │
    ├─ Question → nomic-embed-text → query vector
    ├─ Cosine similarity search → top-K chunks
    └─ Ranked results with score, text, filename, content_type
```

### Chunking Strategy

DocRAFT does **not** chunk by token count or character limit alone. The `MarkdownNodeParser` from LlamaIndex splits documents at semantic heading boundaries first, preserving:

- Section context and hierarchy
- Table integrity (tables are not split mid-row)
- Figure-to-caption associations
- Cross-reference metadata

A second pass using `SentenceSplitter` (512-char chunks, 64-char overlap) then sub-chunks any structural node that exceeds the safe token limit for the embedding model. This two-pass strategy ensures both structural meaning and vector model compatibility.

### Image Intelligence Strategy

Image analysis runs in two sequential passes to optimize performance:

- **Pass 1 (fast):** All images are saved to `data/images/<document_stem>/` as PNG files without any AI processing. This ensures no images are lost if AI inference fails.
- **Pass 2 (slow, per image):** Each saved image is analyzed with RapidOCR first (to extract technical labels and text), then passed to the Granite Vision model alongside the OCR context. The resulting description is injected back into the Markdown before chunking, making visual content semantically searchable.

---

## Prerequisites

Before installing DocRAFT, ensure the following are available on your system:

1. **Python 3.12** — Required for compatibility with Docling and LlamaIndex. Python 3.13 is **not supported** as several core AI libraries have not yet released compatible wheels.
2. **NVIDIA GPU** — Strongly recommended. Vision AI inference (Granite 3.2) and Docling's layout model are significantly faster on GPU. CPU is supported but expect 5–10× slower ingestion for documents with images.
3. **Ollama** — Local LLM and embedding runtime. [Download from ollama.ai](https://ollama.ai/).
4. **Git** — For cloning the repository.
5. **Node.js 22+** — Required for the Next.js frontend.
6. **Docker** *(optional)* — Required only for the Docker Compose deployment path.

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

### Fine-Tuned Model Setup (Ulysses)

Our primary conversational LLM is **Ulysses**, a fine-tuned model hosted on Hugging Face:
*   **Hugging Face Repository**: [jalpan04/Ulysses](https://huggingface.co/jalpan04/Ulysses)

To import and run Ulysses in Ollama:
1. Download the GGUF model files from the Hugging Face repository.
2. Create a file named `Modelfile` in the download directory with the following content:
   ```dockerfile
   FROM ./ulysses-q8_0.gguf
   TEMPLATE "{{ if .System }}<|im_start|>system
   {{ .System }}<|im_end|>
   {{ end }}<|im_start|>user
   {{ .Prompt }}<|im_end|>
   <|im_start|>assistant
   "
   SYSTEM "You are DocRAFT, a helpful document assistant."
   PARAMETER temperature 0.0
   PARAMETER stop "<|im_end|>"
   ```
3. Build and register the model inside Ollama:
   ```powershell
   ollama create ulysses -f ./Modelfile
   ```

> All models must be available locally before starting the backend. The embedding pipeline and vision analysis will fail if any required model is missing from Ollama.

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

Open `.env` and configure paths, model names, and Qdrant settings as needed for your environment. The key variables are:

```env
OLLAMA_HOST=http://localhost:11434
EMBED_MODEL=nomic-embed-text
VISION_MODEL=granite3.2-vision:2b
QDRANT_HOST=localhost
QDRANT_PORT=6333
ENVIRONMENT=development
```

### Step 3 — Install Python Dependencies

> **Python 3.12 is required.** If you have multiple Python versions installed, use `py -3.12` to target the correct interpreter.

```powershell
cd backend

# Create a virtual environment with Python 3.12
py -3.12 -m venv .venv

# Activate it
.\.venv\Scripts\activate

# Upgrade pip first
python -m pip install --upgrade pip

# Install all backend dependencies
pip install -r requirements.txt
```

#### Optional: NVIDIA GPU Acceleration

If you have an NVIDIA GPU, install CUDA-enabled PyTorch after the above step for significantly faster document ingestion:

```powershell
# CUDA 12.4 — check https://pytorch.org/get-started/locally/ for other versions
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
```

> **Note:** Vision AI analysis (diagram extraction and OCR) runs 5–10× slower on CPU compared to GPU. For large document sets, NVIDIA GPU + CUDA is strongly recommended.

### Step 4 — Install Frontend Dependencies

```powershell
cd frontend
npm install
```

---

## Running the System

### Option A: Local Development (No Docker Required)

When running locally with `ENVIRONMENT=development` and default `QDRANT_HOST=localhost`, the backend automatically switches to **Local Disk Mode** for Qdrant. Vector data is persisted to `backend/local_qdrant/` — no separate Qdrant service or Docker container is needed.

**Terminal 1 — Backend:**

```powershell
cd backend
.\.venv\Scripts\activate
uvicorn main:app
```

> **Important:** Do **not** use `uvicorn main:app --reload` in local disk mode. The `--reload` flag starts two processes simultaneously, both of which attempt to lock the same `local_qdrant/` folder, causing a `PermissionError`. Use the basic `uvicorn main:app` command for local development.

**Terminal 2 — Frontend:**

```powershell
cd frontend
npm run dev
```

Once running:

| Service | URL |
|---|---|
| Frontend | `http://localhost:3000` |
| Backend API | `http://localhost:8000` |
| Swagger UI (Interactive Docs) | `http://localhost:8000/docs` |
| ReDoc API Reference | `http://localhost:8000/redoc` |

### Option B: Docker Compose (Full Stack)

Starts the complete stack: FastAPI backend, Next.js frontend, and a networked Qdrant vector database as Docker containers. In this mode, the backend connects to Qdrant as a service (`vector-db`) rather than using local disk storage.

```powershell
docker compose -f infra/docker-compose.yml up --build
```

| Service | Default URL |
|---|---|
| FastAPI Backend | `http://localhost:8000` |
| Next.js Frontend | `http://localhost:3000` |
| Qdrant REST API | `http://localhost:6333` |
| Qdrant Dashboard | `http://localhost:6333/dashboard` |


---

## Observability & Tracing

DocRAFT is integrated with **Arize Phoenix** for real-time observability, tracing, and evaluation. This allows you to inspect the FastAPI request spans, the LangGraph agent state transitions, Qdrant retriever queries, BGE cross-encoder rerankers, and the local Ollama LLM execution token details.

### Running Arize Phoenix

1. **Option A: Docker Compose (Default)**
   Arize Phoenix is automatically included as a service (`phoenix`) in the Docker Compose stack. When running via:
   ```powershell
   docker compose -f infra/docker-compose.yml up --build
   ```
   The Phoenix UI will be available at: **http://localhost:6006**

2. **Option B: Local Development**
   To start the Phoenix collector server on your host machine:
   * Activate the virtual environment:
     ```powershell
     .\.venv\Scripts\Activate.ps1
     ```
   * Start the server:
     ```powershell
     python -m phoenix.server.main serve
     ```
   * The UI will be available at: **http://localhost:6006**

### Viewing Traces

Once the Phoenix server is running:
1. Trigger a query through the UI or via terminal commands.
2. Open **http://localhost:6006** in your browser.
3. Click the project dropdown in the top-left corner and select **DocRAFT** (this project is created dynamically on the first trace).
4. Inspect the trace waterfalls, token counts, and step-by-step latency metrics.

---

## API Reference

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness probe. Returns system status, environment, and timestamp. Used by the frontend status indicator. |
| `POST` | `/upload` | Accepts a PDF file, queues it for background ingestion, and immediately returns a task ID. |
| `GET` | `/status/{task_id}` | Poll the status of a background ingestion task (queued → processing → completed / failed). |
| `POST` | `/query` | Embeds the input query and performs cosine similarity search. Returns top-K ranked chunks with scores and metadata. |
| `GET` | `/documents` | Lists all document chunks currently indexed in the vector database, with source filename and content preview. |

---

### `POST /upload`

Upload and ingest a PDF document. The endpoint returns immediately with a task ID while the pipeline runs in the background.

**Request:** `multipart/form-data`

| Field | Type | Description |
|---|---|---|
| `file` | `File` | The PDF file to ingest. |

**Response (202 Accepted):**

```json
{
  "task_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "queued",
  "message": "Document ingestion started in background."
}
```

**Example (cURL):**

```bash
curl -X POST http://localhost:8000/upload \
  -F "file=@my_document.pdf"
```

---

### `GET /status/{task_id}`

Poll the processing status of a previously submitted ingestion task.

**Response (while processing):**

```json
{
  "status": "processing",
  "filename": "architecture_overview.pdf",
  "message": "Starting pipeline..."
}
```

**Response (on success):**

```json
{
  "status": "completed",
  "filename": "architecture_overview.pdf",
  "chunks_created": 42,
  "message": "Multimodal ingestion complete."
}
```

**Response (on failure):**

```json
{
  "status": "failed",
  "filename": "architecture_overview.pdf",
  "message": "Detailed error reason here."
}
```

Possible status values: `queued` → `processing` → `completed` | `failed`

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
      "id": "8a798507-5409-4cd8-98f2-f708e3e0f63b",
      "score": 0.921,
      "text": "The system architecture comprises three core services...",
      "filename": "architecture_overview.pdf",
      "image_path": null,
      "content_type": "text"
    },
    {
      "id": "c3f1a2b4-...",
      "score": 0.876,
      "text": "Image from page 4. Description: The diagram shows...",
      "filename": "architecture_overview.pdf",
      "image_path": "data/images/architecture_overview/image_p4_pic_0.png",
      "content_type": "image"
    }
  ]
}
```

> **Note:** The `content_type` field distinguishes text chunks (`"text"`) from image description chunks (`"image"`). Image chunks include an `image_path` pointing to the saved PNG on disk.

**Example (cURL):**

```bash
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Explain the system architecture", "limit": 3}'
```

---

### `GET /documents`

Returns a paginated list of all indexed document chunks stored in Qdrant (up to 100 per call).

**Response:**

```json
{
  "documents": [
    {
      "id": "8a798507-5409-4cd8-98f2-f708e3e0f63b",
      "filename": "architecture_overview.pdf",
      "content_preview": "The system architecture comprises three core services..."
    },
    {
      "id": "c3f1a2b4-...",
      "filename": "design_spec.pdf",
      "content_preview": "Image from page 4. Description: The diagram shows..."
    }
  ]
}
```

---

## Project Structure

```
DocRAFT/
├── .env                          # Local environment config (git-ignored, NEVER commit)
├── .gitignore
├── AGENT.md                      # AI assistant context file
├── README.md
│
├── backend/                      # FastAPI application
│   ├── main.py                   # App entry point, all route definitions
│   ├── requirements.txt          # Python dependencies
│   ├── Dockerfile                # python:3.12-slim based image
│   ├── .dockerignore
│   ├── local_qdrant/             # Auto-created local vector DB storage (git-ignored)
│   ├── cache/                    # Fast local semantic caching
│   │   └── semantic_cache.py     # Async-safe LRU query embedding semantic cache
│   ├── retrieval/                # RAG retrieval and Agent loops
│   │   ├── baseline_test.py      # Ollama + Qdrant connection test
│   │   ├── ingest_test.py        # Embedding + Qdrant upsert prototype
│   │   ├── agent.py              # Stateful LangGraph loop (Retrieve ➔ Generate ➔ Critic ➔ Refine)
│   │   └── reranker.py           # BGE Reranker cross-encoder wrapper
│   └── ingestion/                # Multimodal PDF processing pipeline
│       ├── __init__.py
│       ├── config.py             # Pipeline configuration constants (paths, models, chunk sizes)
│       ├── converter.py          # Docling PDF-to-Markdown wrapper with image extraction
│       ├── image_processor.py    # RapidOCR + Granite Vision AI image analysis
│       ├── chunker.py            # LlamaIndex MarkdownNodeParser + SentenceSplitter
│       └── pipeline.py           # End-to-end orchestrator (Steps 1 → 1.5 → 1.8 → 2 → 3 → 4)
│
├── frontend/                     # Next.js application
│   ├── app/                      # App Router pages and layouts
│   ├── package.json              # Next.js 16 + React 19 + Tailwind CSS 4
│   ├── Dockerfile
│   └── AGENTS.md                 # Next.js-specific agent rules
│
├── infra/                        # Infrastructure configuration
│   ├── docker-compose.yml        # Backend + Frontend + Qdrant container orchestration
│   └── .env.example              # Template for .env
│
└── data/                         # Documents and generated artifacts
    ├── pdfs/                     # Raw input PDFs (git-ignored)
    ├── markdown/                 # Converted Markdown output with injected AI descriptions (git-ignored)
    └── images/                   # Extracted images per document (git-ignored)
```

---

## Performance Notes

| Scenario | Speed | Notes |
|---|---|---|
| Semantic Cache Hit | **0ms** (Instant) | Cosine similarity check matches query at $\ge 0.92$, bypassing DB & LLM. |
| Text-only PDF (no images) | Fast | Docling parsing + chunking + embedding only |
| PDF with diagrams (NVIDIA GPU) | Moderate | Vision inference ~2–5s per image on GPU |
| PDF with diagrams (CPU only) | Slow | Vision inference 5–10× slower without CUDA |
| BGE Cross-Encoder Rerank | ~1–2s | Deep cross-encoder scoring of top 15 candidates on CPU (toggled in `.env`). |
| Large document (50+ pages) | 30–60 chunks typical | Each chunk embedded and stored independently |
| First run (model download) | One-time overhead | RapidOCR ONNX models download automatically on first use |

- Embedding is performed per-chunk using **BAAI/bge-large-en** (1024 dimensions, CPU) or **nomic-embed-text** (768 dimensions, Ollama).
- Vector similarity search uses **cosine distance** in Qdrant.
- Local Qdrant storage is persisted to `backend/local_qdrant/` and survives backend restarts.
- On first use, RapidOCR automatically downloads its ONNX model weights (~15MB) from ModelScope.
- For large-scale deployments, switch to a networked Qdrant instance via Docker Compose.

---

## Authors

Built by **Smit Shah** & **Jalpan Vyas**

---

*DocRAFT — Local-first, multimodal, enterprise-ready RAG.*
