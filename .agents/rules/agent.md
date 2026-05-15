---
trigger: always_on
---

# AGENT.md — DocRAFT Project Context

> This file provides full project context for any AI coding assistant working on DocRAFT.
> Read this entire file before writing any code.

---

## 1. Project Identity

- **Name**: DocRAFT (Document Retrieval-Augmented Fine-Tuning)
- **Tagline**: Enterprise-Grade RAFT Agent for intelligent document processing and knowledge extraction at scale.
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
| Embedding Model | nomic-embed-text | -- | Vector embeddings (768 dimensions) |
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
| 3 | Docling integration; build PDF to Markdown to LlamaIndex chunking pipeline | Jalpan04 | AI/Ml | OPEN |
| 5 | FastAPI endpoints: /upload, /query, /documents; basic health checks | ayoitssmit | Full-Stack | OPEN |
| 26 | Data Collection: Gather 50-200 technical PDF manuals for RAG corpus | Jalpan04, ayoitssmit | AI/Ml | OPEN |

#### Week 3

| # | Title | Assignee | Labels | State |
|---|---|---|---|---|
| 6 | Implement bge-large-en embeddings + Qdrant ingestion; run first semantic queries | Jalpan04 | AI/Ml | OPEN |
| 7 | Next.js chat UI with Vercel AI SDK streaming; document upload modal | ayoitssmit | Full-Stack, Frontend | OPEN |

#### Week 4

| # | Title | Assignee | Labels | State |
|---|---|---|---|---|
| 8 | Add bge-reranker cross-encoder; validate two-pass retrieval quality vs single-pass | Jalpan04 | AI/Ml | OPEN |
| 9 | Connect frontend to FastAPI; end-to-end upload to query demo working | Jalpan04, ayoitssmit | Full-Stack | OPEN |

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



