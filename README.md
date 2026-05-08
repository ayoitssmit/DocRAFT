# DocRAFT

**Enterprise-Grade RAFT (Retrieval-Augmented Fine-Tuning) Agent.**

> Intelligent document processing and knowledge extraction at scale.

---

## Tech Stack

| Layer      | Technology                  | Purpose                       |
| ---------- | --------------------------- | ----------------------------- |
| Frontend   | Next.js 16 + Tailwind CSS 4 | App Router, TypeScript        |
| Backend    | FastAPI + Uvicorn            | Async Python API              |
| Vector DB  | Qdrant                       | Embedding storage & retrieval |
| LLM Engine | Ollama (local)               | Inference & embeddings        |
| Infra      | Docker Compose               | Development orchestration     |

## Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (with Compose v2)
- [Ollama](https://ollama.ai/) running locally with required models

### 1 — Clone & configure

```bash
git clone <repo-url>
cd DocRAFT
cp infra/.env.example .env        # then edit values as needed
```

### 2 — Run with Docker Compose (recommended)

```bash
docker compose -f infra/docker-compose.yml up --build
```

| Service  | URL                        |
| -------- | -------------------------- |
| Frontend | http://localhost:3000       |
| Backend  | http://localhost:8000       |
| API Docs | http://localhost:8000/docs  |
| Qdrant   | http://localhost:6333       |

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

## Project Structure

```
DocRAFT/
├── backend/                 # FastAPI application
│   ├── main.py              # App entry point + /health endpoint
│   ├── requirements.txt     # Python dependencies
│   ├── Dockerfile           # Backend container
│   └── retrieval/           # Retrieval pipeline (tests)
├── frontend/                # Next.js application
│   ├── app/                 # App Router pages
│   ├── Dockerfile           # Frontend container
│   └── package.json
├── infra/                   # Infrastructure
│   ├── docker-compose.yml   # Development stack orchestration
│   └── .env.example         # Environment variable template
├── data/                    # Sample documents & datasets
├── .env                     # Local environment config (git-ignored)
└── README.md
```

## API Endpoints

| Method | Path      | Description          |
| ------ | --------- | -------------------- |
| GET    | `/`       | Service info         |
| GET    | `/health` | Liveness probe       |
| GET    | `/docs`   | Swagger UI (auto)    |

---

*Week 1 — Project Scaffold (`feature/project-scaffold`)*
