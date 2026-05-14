# DocRAFT

**Enterprise-Grade RAFT (Retrieval-Augmented Fine-Tuning) Agent.**

> Intelligent document processing and knowledge extraction at scale — powered by Docling, LlamaIndex, Qdrant, and Ollama.

---

## Tech Stack

| Layer        | Technology                   | Purpose                                   |
| ------------ | ---------------------------- | ----------------------------------------- |
| Frontend     | Next.js 16 + Tailwind CSS 4  | App Router, TypeScript, live health UI    |
| Backend      | FastAPI + Uvicorn             | Async Python API, hot-reload in dev       |
| PDF Parsing  | Docling (IBM)                | Layout-aware PDF parsing + image handling |
| Chunking     | LlamaIndex MarkdownNodeParser| Heading-aware semantic text chunking      |
| Vector DB    | Qdrant                       | Embedding storage & semantic retrieval    |
| LLM Engine   | Ollama (local)               | Inference & embedding generation          |
| Infra        | Docker Compose               | Development stack orchestration           |

---

## How It Works

DocRAFT implements a full **Retrieval-Augmented Generation (RAG)** ingestion and query pipeline:

```
PDF Upload
    │
    ▼
Docling DocumentConverter
    │  Layout-aware parsing, table extraction, image annotation
    ▼
LlamaIndex MarkdownNodeParser
    │  Heading-aware chunking → N semantic chunks with metadata
    ▼
Ollama nomic-embed-text
    │  Each chunk → 768-dimensional dense vector embedding
    ▼
Qdrant Vector Database
    │  Chunks stored as searchable points with full payload
    ▼
/query endpoint
    │  Question → embedding → cosine similarity search → top-K chunks
    ▼
Ranked Results with scores
```

Each uploaded PDF is broken into **semantic chunks** (not a single blob), meaning retrieval is precise and context-aware. A complex 50-page document might produce 30–50 individually searchable chunks.

---

## Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (with Compose v2)
- [Ollama](https://ollama.ai/) running locally

#### Ollama Setup
Pull the required models before starting the stack:

```bash
# Embedding model (required for /upload and /query)
ollama pull nomic-embed-text

# Core inference model (for future generation features)
ollama pull qwen2.5-coder:7b
```

### 1 — Clone & configure

```bash
git clone https://github.com/ayoitssmit/DocRAFT.git
cd DocRAFT
cp infra/.env.example .env        # then edit values as needed
```

### 2 — Run with Docker Compose (recommended)

```bash
# First run (or after dependency changes) — rebuilds the container image
docker compose -f infra/docker-compose.yml up --build

# Subsequent runs — uses cached image, starts in seconds
docker compose -f infra/docker-compose.yml up
```

| Service       | URL                          | Description                        |
| ------------- | ---------------------------- | ---------------------------------- |
| Frontend      | http://localhost:3000        | Next.js UI with live backend status|
| Backend       | http://localhost:8000        | FastAPI REST API                   |
| API Docs      | http://localhost:8000/docs   | Interactive Swagger UI             |
| Qdrant        | http://localhost:6333        | Vector DB REST API                 |
| Qdrant UI     | http://localhost:6333/dashboard | Visual collection browser       |

### 3 — Run services individually (without Docker)

**Backend:**

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

---

## Project Structure

```
DocRAFT/
├── backend/                    # FastAPI application
│   ├── main.py                 # App entry point, all API routes
│   ├── requirements.txt        # Python dependencies (FastAPI, Docling, LlamaIndex, Qdrant…)
│   ├── Dockerfile              # Backend container with system-level graphics libs
│   └── retrieval/              # Standalone retrieval pipeline test scripts
│       ├── ingest_test.py      # Manual ingestion test (Ollama + Qdrant)
│       └── baseline_test.py    # Baseline semantic search test
├── frontend/                   # Next.js application
│   ├── app/                    # App Router pages & layouts
│   │   ├── page.tsx            # Landing page with live backend health card
│   │   └── layout.tsx          # Root layout & metadata
│   ├── Dockerfile              # Frontend container
│   └── package.json            # Node dependencies (Next.js, Tailwind, Vercel AI SDK)
├── infra/                      # Infrastructure configuration
│   ├── docker-compose.yml      # Full 3-service dev stack (backend + frontend + vector-db)
│   └── .env.example            # Environment variable template
├── data/                       # Sample documents & datasets
├── .env                        # Local environment config (git-ignored)
└── README.md
```

---

## API Endpoints

| Method | Path         | Description                                                |
| ------ | ------------ | ---------------------------------------------------------- |
| GET    | `/`          | Service info and version                                   |
| GET    | `/health`    | Liveness / readiness probe (used by frontend status card)  |
| GET    | `/docs`      | Auto-generated interactive Swagger UI                      |
| POST   | `/upload`    | Upload a PDF → Docling parse → LlamaIndex chunk → embed → store in Qdrant |
| POST   | `/query`     | Semantic search: question → embedding → top-K ranked results from Qdrant |
| GET    | `/documents` | List all stored document chunks with filename and content preview |

### Example: Upload a PDF

```bash
curl -X POST http://localhost:8000/upload \
  -F "file=@your-document.pdf"
```

Response:
```json
{
  "status": "success",
  "chunks_created": 17,
  "filename": "your-document.pdf"
}
```

### Example: Query the Knowledge Base

```bash
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What are the main findings?", "limit": 3}'
```

Response:
```json
{
  "results": [
    {
      "id": "abc123",
      "score": 0.87,
      "text": "The main findings indicate...",
      "filename": "your-document.pdf"
    }
  ]
}
```

---

## Environment Variables

Copy `infra/.env.example` to `.env` at the project root and configure:

| Variable            | Default                            | Description                              |
| ------------------- | ---------------------------------- | ---------------------------------------- |
| `ENVIRONMENT`       | `development`                      | Runtime environment label                |
| `FRONTEND_ORIGIN`   | `http://localhost:3000`            | CORS allowed origin                      |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000`          | Backend URL used by the frontend         |
| `OLLAMA_HOST`       | `http://host.docker.internal:11434`| Ollama endpoint (Docker-aware)           |
| `EMBED_MODEL`       | `nomic-embed-text`                 | Embedding model served by Ollama         |
| `QDRANT_HOST`       | `vector-db`                        | Qdrant host (Docker service name)        |
| `QDRANT_PORT`       | `6333`                             | Qdrant REST port                         |

---

*Week 1 — Project Scaffold (`feature/project-scaffold`)*
*Week 2 — Ingestion Pipeline: Docling + LlamaIndex Chunking + Qdrant Vector Storage*
