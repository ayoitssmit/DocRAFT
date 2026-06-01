# AGENT.md — DocRAFT Project Context

> This file provides full project context for any AI coding assistant working on DocRAFT.
> Read this entire file before writing any code.

---

## 1. Project Identity

- **Name**: DocRAFT (Document Retrieval-Augmented Fine-Tuning)
- **MAIN GOAL**: An autonomous AI agent that ingests complex technical documentation (PDFs, Markdown,server manuals) and delivers fact-grounded answers, auto-generated deployment scripts (Bash/Python), and structured troubleshooting summaries — with zero hallucination and full local privacy.
- **Repository**: `https://github.com/ayoitssmit/DocRAFT`
- **Default branch**: `main`
- **License**: Proprietary (team project)
- **Started**: 2026-05-08

---

## 2. Team

This is a **2-person collaborative project**. Both members work in parallel on different tracks.

| GitHub Handle | Name | Role | Track | GPU |
|---|---|---|---|---|
| `ayoitssmit` | Smit Shah | Admin / Full-Stack Lead | Frontend (Next.js), FastAPI endpoints, DevOps, UI/UX | NO |
| `Jalpan04` | Jalpan Vyas | Collaborator / AI-ML Lead | Document processing, RAG pipeline, embeddings, fine-tuning | **YES (NVIDIA)** |

### Ownership Boundaries

- **Smit (`ayoitssmit`)** owns: `frontend/`, `backend/main.py`, `infra/`, FastAPI route definitions, Docker configuration, CI/CD.
- **Jalpan (`Jalpan04`)** owns: `backend/retrieval/`, `backend/ingestion/`, `data/`, AI/ML pipeline code, model configuration, evaluation scripts.
- **Shared**: `README.md`, `.env`, `backend/requirements.txt`, integration issues.

### Important: When assisting `Jalpan04`, do NOT modify files owned by `ayoitssmit` without explicit instruction, and vice versa.

---

## 3. Tech Stack

### Backend
| Component | Technology | Version | Purpose |
|---|---|---|---|
| API Framework | FastAPI | >=0.111.0 | Async Python REST API |
| Server | Uvicorn | >=0.29.0 | ASGI server with hot-reload |
| Validation | Pydantic | >=2.7.0 | Request/response models |
| LLM Engine | Ollama (local) | latest | Local inference and embeddings |
| LLM Model | Qwen 2.5-coder:7b | -- | Primary inference model |
| Embedding Model | BAAI/bge-large-en | -- | Primary vector embeddings (1024 dimensions) |
| Fallback Embedding | nomic-embed-text | -- | Fallback embeddings via Ollama (768 dimensions) |
| Vector DB | Qdrant | latest (Docker) | Embedding storage and similarity search |
| Doc Processing | Docling | >=2.0.0 | PDF-to-Markdown conversion (Week 2+) |
| Chunking | LlamaIndex | >=0.12.0 | Markdown-aware document chunking (Week 2+) |
| HTTP Client | httpx | >=0.27.0 | Async HTTP requests |
| Env Config | python-dotenv | >=1.0.0 | `.env` file loading |
| Package Mgr | uv | latest | Fast Python package management |

### Frontend
| Component | Technology | Version |
|---|---|---|
| Framework | Next.js | 16.2.6 |
| Language | TypeScript | ^5 |
| UI | React | 19.2.4 |
| Styling | Tailwind CSS | ^4 |
| AI SDK | Vercel AI SDK | ^6.0.176 |

### Infrastructure
| Component | Technology | Purpose |
|---|---|---|
| Container Orchestration | Docker Compose | Dev stack (backend + frontend + Qdrant) |
| Backend Image | python:3.12-slim | Dockerfile base |
| Vector DB | qdrant/qdrant:latest | Docker service |

### Local Development Environment
| Tool | Version |
|---|---|
| OS | Windows |
| Python | 3.13.5 |
| Node.js | 22.18.0 |
| Docker | Docker Desktop with Compose v2 |

---

## 4. Project Structure

```
DocRAFT/
├── .env                          # Local environment config (git-ignored, NEVER commit)
├── .gitignore
├── AGENT.md                      # THIS FILE — AI assistant context
├── README.md
│
├── backend/                      # FastAPI application
│   ├── main.py                   # App entry, /health and / routes
│   ├── requirements.txt          # Python dependencies
│   ├── Dockerfile                # python:3.12-slim based
│   ├── .dockerignore
│   ├── retrieval/                # Week 1 baseline tests
│   │   ├── baseline_test.py      # Ollama + Qdrant connection test
│   │   ├── ingest_test.py        # Embedding + Qdrant upsert prototype
│   │   └── requirements.txt      # Retrieval-specific deps
│   └── ingestion/                # Week 2+ (to be created)
│       ├── __init__.py
│       ├── config.py             # Pipeline configuration constants
│       ├── converter.py          # Docling PDF-to-Markdown wrapper
│       ├── chunker.py            # LlamaIndex MarkdownNodeParser
│       ├── pipeline.py           # End-to-end orchestrator
│       └── test_pipeline.py      # Smoke tests
│
├── frontend/                     # Next.js application
│   ├── app/                      # App Router pages
│   ├── package.json              # Next.js 16 + React 19 + Tailwind 4
│   ├── Dockerfile
│   └── AGENTS.md                 # Next.js-specific agent rules
│
├── infra/                        # Infrastructure config
│   ├── docker-compose.yml        # Backend + Frontend + Qdrant services
│   └── .env.example              # Template for .env
│
└── data/                         # Documents and datasets
    ├── sample_docs.json          # 3 hardcoded test entries (Week 1)
    ├── pdfs/                     # Raw input PDFs (Week 2+, git-ignored)
    └── markdown/                 # Converted Markdown output (debug, git-ignored)
```

---

## 5. Environment Variables

Source: `.env` in repo root. Template at `infra/.env.example`.

```env
# Ollama Configuration
MODEL_NAME=qwen2.5-coder:7b
EMBED_MODEL=nomic-embed-text
OLLAMA_HOST=http://localhost:11434

# Qdrant Configuration
QDRANT_HOST=localhost
QDRANT_PORT=6333

# Backend Configuration
ENVIRONMENT=development
FRONTEND_ORIGIN=http://localhost:3000

# Frontend Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### CRITICAL: The `.env` file is git-ignored. NEVER commit it. NEVER include secrets in code.

When running inside Docker, `OLLAMA_HOST` becomes `http://host.docker.internal:11434` and `QDRANT_HOST` becomes `vector-db` (the Docker service name).

---

## 6. Service URLs (Development)

| Service | URL | Notes |
|---|---|---|
| Frontend | http://localhost:3000 | Next.js dev server |
| Backend API | http://localhost:8000 | FastAPI with Uvicorn |
| API Docs (Swagger) | http://localhost:8000/docs | Auto-generated |
| Qdrant REST | http://localhost:6333 | Vector DB dashboard |
| Qdrant gRPC | localhost:6334 | For high-performance clients |
| Ollama | http://localhost:11434 | Local LLM inference |

---

## 7. Git Workflow

### Branch Strategy

- **`main`** — Production-ready and stable. **NO DIRECT WORK OR COMMITS ALLOWED ON MAIN.**
- **Feature Branches** — All work MUST be done on a separate feature branch. 
  - Pattern: `feature/<short-description>` (e.g., `feature/docling-integration`).
  - Workflow: Create branch -> Work -> PR -> Approve -> Merge to `main` -> **DELETE feature branch immediately**.
- No permanent personal branches (like `jalpan`) are allowed.

### Commit Convention

Use conventional commits with the format:

```
<type>: <short description>
```

Types:
- `feat:` — New feature or functionality
- `fix:` — Bug fix
- `docs:` — Documentation changes
- `chore:` — Maintenance, dependency updates, config changes
- `refactor:` — Code restructuring without behavior change
- `test:` — Adding or modifying tests

Examples from the actual commit history:
```
feat: setup Next.js, FastAPI, and docker-compose scaffold
feat: complete local AI environment baseline and fix qdrant deprecation
fix: update ingest_test.py to use query_points API for better compatibility
chore: add .gitignore for environment and python files
docs: add detailed Ollama setup instructions to README
```

### Pull Request Workflow

1. Create a feature branch from `main` (or from your personal branch).
2. Make commits with conventional commit messages.
3. Open a PR against `main`.
4. The other team member reviews and approves.
5. Merge via GitHub (squash or merge commit).
6. Reference the GitHub issue number in the PR title or description (e.g., `Closes #3`).

### Issue Referencing

- Every piece of work maps to a GitHub issue.
- Reference issues in commits: `feat: add Docling converter (#3)`
- Close issues via PR descriptions: `Closes #3`
- Do not work on tasks that do not have a corresponding issue.

---

## 8. GitHub Issues — Complete Roadmap

### Labels

| Label | Color | Purpose |
|---|---|---|
| `AI/Ml` | cyan | AI/ML pipeline tasks |
| `Full-Stack` | orange | Backend + integration tasks |
| `Frontend` | dark red | UI/UX tasks |
| `DevOps` | lime | Infrastructure and CI/CD |
| `Observability` | pink | Monitoring and tracing |
| `Architecture` | green | System design |
| `Evaluation` | beige | Model evaluation |
| `Testing` | teal | Test coverage |
| `Security` | yellow | Security concerns |
| `Optimization` | green | Performance improvements |

### Milestones

| Milestone | Status | Open | Closed |
|---|---|---|---|
| Month 1 -- Foundation | Active | 8 | 2 |
| Month 2 -- Intelligence Layer | Open | 8 | 0 |
| Month 3 -- Production & Polish | Open | 9 | 0 |

### All Issues (Ordered by Week)

#### Week 1 (COMPLETED)

| # | Title | Assignee | Labels | State |
|---|---|---|---|---|
| 1 | Environment setup: Ollama + Qdrant + Qwen 2.5 baseline inference | Jalpan04 | AI/Ml | CLOSED |
| 4 | Project scaffold: Next.js + FastAPI + Docker Compose | ayoitssmit | Full-Stack, DevOps | CLOSED |

#### Week 2 (CURRENT)

| # | Title | Assignee | Labels | State |
|---|---|---|---|---|
| 3 | Docling integration; build PDF to Markdown to LlamaIndex chunking pipeline | Jalpan04 | AI/Ml | CLOSED |
| 5 | FastAPI endpoints: /upload, /query, /documents; basic health checks | ayoitssmit | Full-Stack | CLOSED |
| 26 | Data Collection: Gather 50-200 technical PDF manuals for RAG corpus | Jalpan04, ayoitssmit | AI/Ml | OPEN |

#### Week 3

| # | Title | Assignee | Labels | State |
|---|---|---|---|---|
| 6 | Implement bge-large-en embeddings + Qdrant ingestion; run first semantic queries | Jalpan04 | AI/Ml | CLOSED |
| 7 | Next.js chat UI with Vercel AI SDK streaming; document upload modal | ayoitssmit | Full-Stack, Frontend | CLOSED |

#### Week 4

| # | Title | Assignee | Labels | State |
|---|---|---|---|---|
| 8 | Add bge-reranker cross-encoder; validate two-pass retrieval quality vs single-pass | Jalpan04 | AI/Ml | CLOSED |
| 9 | Connect frontend to FastAPI; end-to-end upload to query demo working | Jalpan04, ayoitssmit | Full-Stack | CLOSED |

#### Week 5

| # | Title | Assignee | Labels | State |
|---|---|---|---|---|
| 10 | Generate synthetic Q&A fine-tuning dataset (500 pairs) using base model + Docling output | Jalpan04 | AI/Ml | OPEN |
| 11 | Document manager UI: list, delete, version documents; storage layer | ayoitssmit | Full-Stack, Frontend | OPEN |

#### Week 6

| # | Title | Assignee | Labels | State |
|---|---|---|---|---|
| 12 | QLoRA fine-tuning run with Unsloth + Axolotl; first eval against base model | Jalpan04 | AI/Ml | OPEN |
| 13 | Terminal window component for script rendering; syntax highlighting | ayoitssmit | Full-Stack, Frontend | OPEN |

#### Week 7

| # | Title | Assignee | Labels | State |
|---|---|---|---|---|
| 14 | Implement LangGraph agentic loop with re-query logic (up to 3 iterations) | Jalpan04 | AI/Ml | OPEN |
| 15 | Arize Phoenix integration: instrument FastAPI + LangGraph with trace spans | Jalpan04, ayoitssmit | Full-Stack, Observability | OPEN |

#### Weeks 8-12 (Month 3 -- Production & Polish)

Issues 16-25 cover: Kubernetes deployment, RBAC, audit logging, load testing, final evaluation benchmarks, documentation, and demo preparation. These are tracked under the "Month 3 -- Production & Polish" milestone.

---

## 9. Architecture Decisions

### RAG Pipeline (Target Architecture)

```
User Query
    |
    v
FastAPI /query endpoint
    |
    v
Embedding (nomic-embed-text via Ollama) --> Week 2 baseline, bge-large-en in Week 3
    |
    v
Qdrant vector similarity search
    |
    v
Optional: bge-reranker cross-encoder (Week 4)
    |
    v
LLM generation (Qwen 2.5-coder:7b via Ollama) --> fine-tuned model in Week 6+
    |
    v
Streaming response to frontend (Vercel AI SDK)
```

### Document Ingestion Pipeline (Issue #3)

```
PDF files (data/pdfs/)
    |
    v
Docling DocumentConverter --> Structured Markdown
    |
    v
LlamaIndex MarkdownNodeParser --> Heading-aware chunks with metadata
    |
    v
Ollama nomic-embed-text --> 768-dim vectors
    |
    v
Qdrant upsert --> docraft_knowledge collection
```

### Key Design Choices

1. **Docling Markdown export** over Docling JSON: simpler, human-readable, sufficient for heading-aware chunking. Switch to JSON export only if bounding-box metadata becomes necessary.
2. **MarkdownNodeParser** over SentenceSplitter: respects document heading hierarchy, producing semantically coherent chunks.
3. **nomic-embed-text** for Week 2 baseline. Upgrade to **bge-large-en** in Week 3 for production-quality embeddings.
4. **Local-first**: All AI inference runs locally via Ollama. No cloud API dependencies. This is critical for processing sensitive enterprise documents.
5. **Qdrant collection name**: `docraft_knowledge` (established in Week 1 prototype).

---

## 10. Existing Code Patterns

### Environment Loading Pattern

All backend scripts load `.env` from the repo root using:
```python
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)
```

Adjust the number of `.parent` calls based on file depth.

### Ollama Client Pattern

```python
from ollama import Client

client = Client(host=os.getenv("OLLAMA_HOST", "http://localhost:11434"))
response = client.embeddings(model=EMBED_MODEL, prompt=text)
embedding = response['embedding']  # Returns list[float], 768 dimensions
```

### Qdrant Client Pattern

```python
from qdrant_client import QdrantClient
from qdrant_client.http import models

client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)

# Create collection
client.create_collection(
    collection_name=COLLECTION_NAME,
    vectors_config=models.VectorParams(size=vector_size, distance=models.Distance.COSINE),
)

# Upsert
client.upsert(collection_name=COLLECTION_NAME, points=points)

# Query (use query_points, NOT search — the old API is deprecated)
results = client.query_points(
    collection_name=COLLECTION_NAME,
    query=query_vector,
    limit=3
).points
```

### FastAPI Pattern

```python
from fastapi import FastAPI
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    yield
    # shutdown

app = FastAPI(title="DocRAFT API", version="0.1.0", lifespan=lifespan)
```

---

## 11. Coding Standards

### Python

- **Python 3.10+** minimum (Docling requirement). Local env is 3.13.5.
- Use **type hints** on all function signatures.
- Use **docstrings** on all public functions and classes.
- Use **logging** (not print) for all output. Logger name convention: `logging.getLogger(__name__)`.
- Use **pathlib.Path** for all file system operations, not `os.path`.
- Follow PEP 8. Max line length: 100 characters.
- Use `async def` for all FastAPI route handlers.
- Group imports: stdlib, third-party, local. Separate with blank lines.

### TypeScript/React

- Use Next.js App Router conventions (not Pages Router).
- All components in TypeScript (`.tsx`).
- Use Tailwind CSS 4 for styling.
- Read `frontend/node_modules/next/dist/docs/` before writing Next.js code (breaking changes from older versions).

### General

- No hardcoded secrets or API keys anywhere in the codebase.
- No `print()` in production code; use structured logging.
- Prefer composition over inheritance.
- Every new module must have a corresponding test or smoke test.

---

## 12. Things to AVOID

1. **NEVER commit `.env` files.** The `.env` has been purged from git history once already.
2. **NEVER use the deprecated Qdrant `search()` method.** Use `query_points()` instead.
3. **NEVER use `os.path`** for file operations. Use `pathlib.Path`.
4. **NEVER add cloud API dependencies** (OpenAI, Anthropic, etc.) without explicit approval. This project is local-first.
5. **NEVER modify files outside your ownership track** without coordination (see Section 2).
6. **NEVER use `SentenceSplitter`** for document chunking when Markdown structure is available. Use `MarkdownNodeParser`.
7. NEVER install packages globally. **Always use the local `venv` in the `backend/` directory.**
8. NEVER push directly to `main` without a PR for non-trivial changes.
9. **NEVER use emojis** in code comments, commit messages, or documentation.
10. **NEVER create placeholder/stub implementations** without marking them clearly with `# TODO: <issue-number>` comments.
11. **ALWAYS prioritize GPU/CUDA acceleration** for AI-ML tasks on `Jalpan04` machine (Docling, Training, Inference). Ensure code checks for `torch.cuda.is_available()`.

---

## 13. Running the Project

#### 13.1. Environment Setup (MANDATORY)
To ensure library consistency between `ayoitssmit` and `Jalpan04`, both MUST use a virtual environment named `venv` inside the `backend/` directory.

**Exact Steps to Setup:**
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate the virtual environment using `uv`:
   ```bash
   uv venv
   .\.venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   uv pip install -r requirements.txt
   ```

#### 13.2. Running with Docker Compose (Recommended)
```bash
docker compose -f infra/docker-compose.yml up --build
```

### Option B: Local development

```bash
# Terminal 1: Ensure Ollama is running with required models
ollama serve
ollama pull qwen2.5-coder:7b
ollama pull nomic-embed-text

# Terminal 2: Ensure Qdrant is running
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant:latest

# Terminal 3: Backend
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 4: Frontend
cd frontend
npm install
npm run dev
```

### Running Tests

```bash
# Baseline environment test
python backend/retrieval/baseline_test.py

# Embedding + Qdrant ingestion test
python backend/retrieval/ingest_test.py

# Ingestion pipeline test (Week 2+)
python -m backend.ingestion.test_pipeline
```

---

## 14. Dependency Management

### Backend (Python)

- All dependencies go in `backend/requirements.txt`.
- Pin minimum versions with `>=`, not exact pins (allows flexibility).
- **Use `uv pip install -r requirements.txt`** for installation.
- When adding a new dependency, also update the Dockerfile if it needs system-level libraries.
- The `backend/retrieval/requirements.txt` is a subset used for standalone retrieval scripts.

### Frontend (Node.js)

- Use `npm install` (not yarn or pnpm).
- Lock file: `package-lock.json` (committed to git).
- Tailwind CSS 4 uses `@tailwindcss/postcss` (not the old `tailwindcss` PostCSS plugin).

---

## 15. Docker Notes

- Backend Dockerfile: `python:3.12-slim` base. Installs `build-essential`. Will need `libgl1` and `libglib2.0-0` after Docling integration.
- Frontend Dockerfile: Runs `next dev` for development.
- Qdrant: Official `qdrant/qdrant:latest` image. Data persisted in `qdrant_data` Docker volume.
- Ollama runs on the **host machine** (not in Docker). Docker services access it via `host.docker.internal:11434`.

---

## 16. Current Status (as of 2026-06-01)

- **Week 1**: COMPLETED. Project scaffold, environment setup, Ollama + Qdrant baseline confirmed working.
- **Week 2**: COMPLETED. Docling converter, LlamaIndex Markdown chunking pipeline, and async background task worker fully implemented (Issue #3). FastAPI endpoints for `/upload`, `/query`, `/documents` fully live (Issue #5). Issue #26 (data collection) is active and in progress.
- **Week 3**: COMPLETED. BGE-Large-en (1024-dim) dense embeddings integrated and set as primary (Issue #6). Next.js premium chat UI with custom base64 sources streaming and upload modal completed (Issue #7).
- **Week 4**: COMPLETED. BGE-Reranker-v2-m3 (cross-encoder) fully enabled in the backend for two-pass retrieval (Issue #8). End-to-end pipeline fully connected, optimized, and verified (Issue #9).
- **Recent Technical Polish**: Normalized Windows-specific file paths for static image serving (`decodeURIComponent` fix), added block-level LaTeX delimiter auto-balancing to isolate formatting parsing errors, and added 1500-character chunking limit optimized for diagrams and tables.

---

## 17. Future Technology Introductions

These are planned but NOT yet installed. Do not add them prematurely.

| Week | Technology | Purpose | Issue |
|---|---|---|---|
| 3 | bge-large-en | Production embedding model | #6 |
| 3 | Vercel AI SDK streaming | Chat UI | #7 |
| 4 | bge-reranker | Cross-encoder reranking | #8 |
| 5 | Unsloth + Axolotl | QLoRA fine-tuning framework | #12 |
| 7 | LangGraph | Agentic loop with re-query | #14 |
| 7 | Arize Phoenix | Observability and tracing | #15 |

---

## 18. Useful Commands Reference

```bash
# Check all open issues assigned to you
gh issue list --assignee "@me" --repo ayoitssmit/DocRAFT

# Check issues for a specific week
gh issue list --search "Week 2" --repo ayoitssmit/DocRAFT

# View issue details
gh issue view <number> --repo ayoitssmit/DocRAFT

# Create a feature branch
git checkout -b feature/<name>

# Standard development cycle
git add .
git commit -m "feat: description (#issue-number)"
git push origin feature/<name>
# Then open PR on GitHub
```
