# DocRAFT

**Enterprise-Grade RAFT (Retrieval-Augmented Fine-Tuning) Agent.**

> Intelligent document processing, multimodal knowledge extraction, and semantic search at scale — powered by Docling, LlamaIndex, Qdrant, and Ollama.

---

## 🚀 Technical Highlights

- **Multimodal Ingestion**: High-fidelity PDF-to-Markdown conversion using Docling.
- **Vision Intelligence**: Automated diagram and chart analysis via Ollama Vision models (Granite 3.2).
- **OCR-Augmented Retrieval**: Integrated RapidOCR for extracting technical labels from images.
- **Local-First Architecture**: Run everything on your own hardware using Ollama and local Qdrant storage.
- **GPU Accelerated**: Optimized for NVIDIA hardware with CUDA-enabled Torch integration.

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

## 🛠️ Prerequisites

1.  **Python 3.12**: (Required for stability with Docling/LlamaIndex).
2.  **NVIDIA GPU**: (Recommended for Vision AI and Ingestion speed).
3.  **Ollama**: [Download here](https://ollama.ai/).

### 🧠 AI Model Setup
Pull the required models to your local Ollama instance:
```powershell
# Technical Chat & Logic
ollama pull qwen2.5-coder:7b

# High-Speed Vector Embeddings
ollama pull nomic-embed-text

# Multimodal Vision (Architectural Diagrams)
ollama pull granite3.2-vision:2b
```

---

## 💻 Setup & Installation

### 1 — Clone & Environment
```powershell
git clone https://github.com/ayoitssmit/DocRAFT.git
cd DocRAFT
cp infra/.env.example .env
```

### 2 — Install Dependencies

Choose the path that matches your hardware:

#### **Option A: GPU (NVIDIA CUDA)** — *Recommended for Vision AI*
```powershell
# Install Core Requirements
pip install -r backend/requirements.txt

# Install CUDA-Enabled Torch (Version 12.4)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
```

#### **Option B: CPU (Universal)** — *Slower for Images/Vision*
```powershell
# Install Core Requirements
pip install -r backend/requirements.txt

# Standard Torch Installation
pip install torch torchvision torchaudio
```

> [!NOTE]
> **Performance Note:** Vision AI analysis (diagram extraction) can take 5-10x longer on a CPU.

---

## 🏗️ Running the System

### Option A: Local Development (Recommended)
This starts the FastAPI backend in local-disk mode (no Docker required for Qdrant).
```powershell
cd backend
..\.venv\Scripts\python.exe -m uvicorn main:app --reload
```
- **API Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### Option B: Docker Compose
Full stack orchestration (Backend + Frontend + Vector DB).
```powershell
docker compose -f infra/docker-compose.yml up --build
```

---

## 📂 Project Structure

- `backend/ingestion/`: Multimodal PDF processing (OCR + Vision).
- `backend/retrieval/`: Search and RAG logic.
- `frontend/`: Next.js 16 + Tailwind CSS 4 Application.
- `data/markdown/`: Enriched document outputs for debugging.
- `local_qdrant/`: Local vector database storage.

---

## 📡 API Endpoints

| Method | Path         | Description                                       |
| ------ | ------------ | ------------------------------------------------- |
| GET    | `/health`    | Liveness probe (used by frontend status card)     |
| POST   | `/upload`    | Process PDF with full Multimodal AI intelligence  |
| POST   | `/query`     | Semantic search over vector database              |
| GET    | `/documents` | List all stored document chunks                   |

### Example: Query the Knowledge Base
```bash
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Explain the system architecture", "limit": 3}'
```

---

*Built by Smit Shah & Jalpan Vyas*
