# DocRAFT

**Enterprise-Grade RAFT (Retrieval-Augmented Fine-Tuning) Agent.**

Intelligent document processing, multimodal knowledge extraction, and semantic search at scale.

---

## 🚀 Technical Highlights

- **Multimodal Ingestion**: High-fidelity PDF-to-Markdown conversion using Docling.
- **Vision Intelligence**: Automated diagram and chart analysis via Ollama Vision models (Granite 3.2).
- **OCR-Augmented Retrieval**: Integrated RapidOCR for extracting technical labels from images.
- **Local-First Architecture**: Run everything on your own hardware using Ollama and local Qdrant storage.
- **GPU Accelerated**: Optimized for NVIDIA hardware with CUDA-enabled Torch integration.

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

## 💻 Local Setup (Windows)

### 1 — Clone & Environment
```powershell
git clone https://github.com/ayoitssmit/DocRAFT
cd DocRAFT
cp infra/.env.example .env
```

### 2 — Configure `.env`
For local development (without Docker), update your `.env` to use the hardcoded IP:
```env
OLLAMA_HOST=http://127.0.0.1:11434
QDRANT_HOST=127.0.0.1
ENVIRONMENT=development
```

### 3 — Install Dependencies

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
> **Performance Note:** Vision AI analysis (diagram extraction) can take 5-10x longer on a CPU. If you are on a CPU-only machine, consider using smaller vision models in your `.env`.

> [!IMPORTANT]
> **Network Tip:** If `pip` or `uv` hangs on your machine, try disabling **IPv6** in your Windows Network Settings. DocRAFT is optimized for IPv4 connectivity.

---

## 🏗️ Running the System

### Option A: The API Server (Recommended)
This starts the FastAPI backend, which handles uploads and queries.
```powershell
cd backend
..\.venv\Scripts\python.exe -m uvicorn main:app --reload
```
- **API Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Upload Endpoints**: Use `/upload` to process PDFs with full Vision AI intelligence.

### Option B: The CLI Pipeline
Process a folder of documents directly from the terminal:
```powershell
# Process a single file
.\.venv\Scripts\python.exe -m backend.ingestion.pipeline --pdf-file data/pdfs/manual.pdf

# Process a whole folder
.\.venv\Scripts\python.exe -m backend.ingestion.pipeline --pdf-dir data/pdfs/
```

---

## 📂 Project Structure

- `backend/ingestion/`: Multimodal PDF processing (OCR + Vision).
- `backend/retrieval/`: Search and RAG logic.
- `data/markdown/`: Enriched document outputs for debugging.
- `local_qdrant/`: Local vector database storage (no Docker required).

---

## 📅 Roadmap

- [x] Multimodal Ingestion Pipeline (Docling + Vision)
- [x] GPU Acceleration (CUDA)
- [x] FastAPI Integration
- [ ] Next.js Chat Interface (Week 3)
- [ ] Agentic Re-Query Logic (Week 7)

---

*Built by Smit Shah & Jalpan Vyas*
