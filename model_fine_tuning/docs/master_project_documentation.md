# DevOps LLM QLoRA Fine-Tuning Pipeline — Master Project Documentation

This document serves as the master technical documentation for the DevOps LLM Fine-Tuning Pipeline. It details the architecture, design choices, data layers, codebase walkthroughs, and deployment procedures for the Ulysses DevOps AI Assistant model.

---

## 1. Project Overview & Stakeholders

### 1.1 Goal
The primary objective of this project is to fine-tune the **Qwen2.5-Coder-7B** base model into a highly domain-specialized **DevOps AI Assistant** named **Ulysses**, capable of running efficiently on consumer-grade hardware. 

The resulting model is designed to assist in containerization, infrastructure orchestration, CI/CD pipeline automation, shell scripting, and Site Reliability Engineering (SRE) tasks. It serves as the underlying reasoning engine for the **DocRAFT** framework.

### 1.2 Key Stakeholders
*   **Engineering Lead:** Smit Shah & Jalpan Vyas (System architecture, training pipelines, and data engineering).
*   **DevOps Teams:** End-users of the fine-tuned assistant.
*   **DocRAFT Maintainers:** Integrators of the model into the downstream retrieval-augmented generation engine.

---

## 2. Project Timeline & Milestones

The development of the pipeline progressed through three distinct chronological phases:

| Milestone / Phase | Date (Approx.) | Objectives | Key Artifacts |
|---|---|---|---|
| **Phase 1: Environment & CPT Data Setup** | June 2026 | Environment configuration, package installation scripts, and Continued Pre-Training (CPT) corpus aggregation. | `setup.sh`, `setup.bat`, `prepare_cpt_data.py`, `pretraining_clean.txt` |
| **Phase 2: Continued Pre-Training (CPT)** | Late June 2026 | Execute 1-epoch continued pre-training on 467 MB of raw DevOps docs. Merging CPT adapter into the base model. | `train_cpt.py`, `outputs/cpt_lora_adapter`, `cpt_training.log` |
| **Phase 3: SFT Data & Supervised Tuning** | Early July 2026 | LLM-based instruction pair generation, 3-epoch Supervised Fine-Tuning (SFT) using 4-bit NF4 QLoRA, GGUF export, and test client creation. | `generate_sft_data.py`, `train_sft.py`, `export_gguf.sh`, `test_gguf_inference.py` |

---

## 3. Architecture & Data Flow

The training pipeline uses a two-phase learning strategy to first teach the model domain vocabulary (CPT) and then teach it assistant behaviors (SFT):

```
                       +-----------------------------+
                       |   Qwen2.5-Coder-7B Base     |
                       +--------------+--------------+
                                      |
                                      v
                       +-----------------------------+
                       |  Phase 1: Continued         | <-- Input: data/pretraining_clean.txt (467 MB)
                       |  Pre-Training (CPT)         |
                       +--------------+--------------+
                                      |
                                      v
                       +-----------------------------+
                       |  outputs/cpt_lora_adapter   |
                       +--------------+--------------+
                                      |
                                      v
                       +-----------------------------+
                       |  Merge CPT Adapter          |
                       |  into Base Model            |
                       +--------------+--------------+
                                      |
                                      v
                       +-----------------------------+
                       |  outputs/merged_devops_model|
                       +--------------+--------------+
                                      |
                                      v
                       +-----------------------------+
                       |  Phase 2: Supervised        | <-- Input: 03_ready_for_qlora/instructions.jsonl
                       |  Fine-Tuning (SFT)          |
                       +--------------+--------------+
                                      |
                                      v
                       +-----------------------------+
                       |  outputs/sft_lora_adapter   |
                       +--------------+--------------+
                                      |
                                      v
                       +-----------------------------+
                       |  Merge SFT Adapter          |
                       |  into CPT-Merged Model      |
                       +--------------+--------------+
                                      |
                                      v
                       +-----------------------------+
                       |  outputs/final_devops_model |
                       +--------------+--------------+
                                      |
                                      v
                       +-----------------------------+
                       |  GGUF Export &              |
                       |  Q4_K_M Quantization        |
                       +--------------+--------------+
                                      |
                                      v
                       +-----------------------------+
                       |  outputs/devops_model_      |
                       |  q4_k_m.gguf (Portable)     |
                       +-----------------------------+
```

---

## 4. File-by-File Breakdown

This section documents every script, configuration, and data file in the workspace.

### 4.1 Scripts (`scripts/`)

#### 4.1.1 `prepare_cpt_data.py`
*   **Path:** `scripts/prepare_cpt_data.py`
*   **Purpose:** Assembles the large-scale pre-training corpus by concatenating clean markdown files and code scripts with metadata delimiters.
*   **Key Components:**
    *   `main()`: Scans raw directories and creates the unified CPT file.
    *   Delimiters: Automatically appends `--- DOCUMENT START ---` and `--- DOCUMENT END ---` to mark document boundaries.
*   **Dependencies:** `os`, `sys`, `json`, `argparse`
*   **Decisions & Rationale:** Replaces invalid characters during file reading by using `errors="ignore"` to prevent execution halts during text processing.

#### 4.1.2 `train_cpt.py`
*   **Path:** `scripts/train_cpt.py`
*   **Purpose:** Main training script for Continued Pre-Training. It loads the base model in 4-bit, applies LoRA, tokenizes the raw text corpus, and trains a next-token prediction adapter.
*   **Key Components:**
    *   `VRAMLoggingCallback`: Class to output GPU VRAM metrics at steps 1, 2, 3, and every 10 steps.
    *   `group_texts()`: Token concatenation and block-slicing logic to create fixed 512-token contexts.
*   **Dependencies:** `torch`, `transformers` (Trainer, BitsAndBytesConfig), `peft` (LoraConfig, get_peft_model), `datasets` (load_dataset)
*   **Decisions & Rationale:** Pad token defaults to the end-of-sequence (`eos_token`) to allow batch training on models like Qwen that do not ship with a dedicated padding token.

#### 4.1.3 `generate_sft_data.py`
*   **Path:** `scripts/generate_sft_data.py`
*   **Purpose:** Calls Gemini API or local Ollama instances to generate SFT chat instruction records from the text corpus.
*   **Key Components:**
    *   `ProgressTracker`: Thread-safe progress manager using a locking mechanism and saving state to `.processing_progress.json`.
    *   `call_llm()`: Formulates prompts asking for 5 specific styles of QA pairs and handles rate limit recovery.
*   **Dependencies:** `google-genai` (or legacy `google-generativeai`), `requests` (for Ollama raw endpoint), `concurrent.futures`
*   **Decisions & Rationale:** Configures thread-safety so that generation tasks can resume without losing progress if interrupted.

#### 4.1.4 `generate_qa_from_chunks.py`
*   **Path:** `scripts/generate_qa_from_chunks.py`
*   **Purpose:** Generates factual QA pairs specifically from pre-chunked DocRAFT data files.
*   **Key Components:**
    *   `process_chunk()`: Throttles calls to local Ollama instance with a 2-second sleep to prevent GPU thermal throttling.
*   **Dependencies:** `requests`, `json`, `time`
*   **Decisions & Rationale:** Operates with a single thread and uses a lower temperature (0.2) to prioritize factual extraction over creative writing.

#### 4.1.5 `train_sft.py`
*   **Path:** `scripts/train_sft.py`
*   **Purpose:** Trains the CPT-merged model on instruction data to follow user chat inputs.
*   **Key Components:**
    *   Prompt Masking logic: Dynamically replaces input prompt token labels with `-100` so loss is computed solely on the assistant's response.
*   **Dependencies:** `transformers` (SFTTrainer), `peft`, `trl`
*   **Decisions & Rationale:** Native PyTorch memory allocator configuration `expandable_segments:True` is set to mitigate GPU VRAM fragmentation errors when processing long sequences.

#### 4.1.6 `merge.py`
*   **Path:** `scripts/merge.py`
*   **Purpose:** Combines LoRA adapter weights directly back into the base model weights.
*   **Key Components:**
    *   `model.merge_and_unload()`: Performs the weight summation and converts the model back into a base Hugging Face class.
*   **Dependencies:** `torch`, `peft` (PeftModel), `transformers`
*   **Decisions & Rationale:** Disables Hugging Face Hub downloads during execution by forcing offline environment variables to prevent local adapter cache issues.

#### 4.1.7 `test_inference.py`
*   **Path:** `scripts/test_inference.py`
*   **Purpose:** Command line client to test the full-precision merged model.
*   **Dependencies:** `transformers`
*   **Decisions & Rationale:** Temperature is set to a low value (0.3) to restrict hallucinations on factual infrastructure queries.

#### 4.1.8 `test_gguf_inference.py`
*   **Path:** `scripts/test_gguf_inference.py`
*   **Purpose:** Console client to test quantized GGUF models locally.
*   **Dependencies:** `llama-cpp-python`
*   **Decisions & Rationale:** Leverages `stream=True` to print tokens as they are generated, matching the visual feedback of modern chat applications.

#### 4.1.9 `test_gguf_inference_ollama.py`
*   **Path:** `scripts/test_gguf_inference_ollama.py` (Custom)
*   **Purpose:** Alternative chat client that calls local Ollama models via HTTP.
*   **Dependencies:** `requests`, `json`
*   **Decisions & Rationale:** Bypasses local C++ compilation issues by relying on Ollama's pre-compiled service.

---

### 4.2 Configuration & Environment Files

#### 4.2.1 `requirements.txt`
*   **Path:** `requirements.txt`
*   **Purpose:** List of core Python package dependencies (PyTorch, transformers, accelerate, peft, bitsandbytes, datasets, trl).
*   **Dependencies:** Managed via Python virtual environments.

#### 4.2.2 `setup.sh` & `setup.bat`
*   **Path:** `setup.sh` (Linux), `setup.bat` (Windows)
*   **Purpose:** Automates virtual environment generation, upgrades pip, and fetches PyTorch pre-compiled with CUDA support.
*   **Decisions & Rationale:** Installs PyTorch directly from the official PyTorch wheel index for CUDA compatibility.

#### 4.2.3 `.gitattributes`
*   **Path:** `.gitattributes`
*   **Purpose:** Instructs Git LFS (Large File Storage) to track the 467 MB pre-training dataset to keep the git repository lightweight.

#### 4.2.4 `.gitignore`
*   **Path:** `.gitignore`
*   **Purpose:** Prevents local virtual environments, checkpoints, raw files, and logs from being committed to source control.

---

### 4.3 Data Layer

#### 4.3.1 `data/pretraining_clean.txt`
*   **Path:** `data/pretraining_clean.txt`
*   **Purpose:** Unified plain-text corpus for CPT phase. Contains ~6.5 million lines of documentation and scripts delimited by metadata headers.

#### 4.3.2 `03_ready_for_qlora/instructions.jsonl`
*   **Path:** `03_ready_for_qlora/instructions.jsonl`
*   **Purpose:** Generated SFT training dataset consisting of instruction-response objects in ChatML format.

---

## 5. Setup & Installation

To replicate the training and execution environment, follow these steps:

### 5.1 Linux Setup
Run the setup shell script to create the environment:
```bash
git clone https://github.com/Jalpan04/devops-qlora-pipeline.git
cd devops-qlora-pipeline
git lfs pull
bash setup.sh
```

### 5.2 Windows Setup
Run the setup batch script in command prompt:
```cmd
git clone https://github.com/Jalpan04/devops-qlora-pipeline.git
cd devops-qlora-pipeline
git lfs pull
setup.bat
```

---

## 6. Training Configurations & Hyperparameters

Below are the detailed training configurations used for both phases of the pipeline.

### 6.1 Continued Pre-Training (CPT) Configuration
*   **Base Model:** `Qwen/Qwen2.5-Coder-7B`
*   **Quantization:** NF4 (4-bit) with Double Quantization
*   **Compute Precision:** bfloat16
*   **LoRA Rank (r):** 16
*   **LoRA Alpha:** 32 (effective scaling of 2.0)
*   **LoRA Target Modules:** `q_proj`, `k_proj`, `v_proj`, `o_proj`, `gate_proj`, `up_proj`, `down_proj`
*   **Effective Batch Size:** 64 (Batch size of 2 per device × 4 gradient accumulation steps × 8 devices)
*   **Learning Rate:** 2e-4 (Cosine scheduler, 3% warmup)
*   **Context Length (Block Size):** 512 tokens

### 6.2 Supervised Fine-Tuning (SFT) Configuration
*   **Base Model:** Merged CPT Model
*   **Quantization:** NF4 (4-bit)
*   **LoRA Rank (r):** 16
*   **LoRA Alpha:** 32
*   **LoRA Target Modules:** Same 7 attention/MLP modules
*   **Effective Batch Size:** 64 (Batch size of 4 × 16 gradient accumulation steps)
*   **Learning Rate:** 2e-5 (Cosine scheduler, 3% warmup)
*   **Context Length (Max Sequence Length):** 4096 tokens
*   **Optimizer:** Paged AdamW (32-bit)

---

## 7. Challenges & Solutions

### 7.1 Compiler & Library Mismatch
*   **Issue:** When attempting to compile `llama-cpp-python` with CUDA on Windows, the C++ compiler (MSVC 19.44) threw error `STL1002`, stating it expected CUDA 12.4 or newer, whereas the system had CUDA 12.3.
*   **Solution:** Injected MSVC preprocessor definitions globally by setting `$env:CL="/D_ALLOW_COMPILER_AND_STL_VERSION_MISMATCH"` and passed `-allow-unsupported-compiler` to `nvcc` via CMake flags.

### 7.2 Native GPU Discovery Failures
*   **Issue:** CMake threw errors stating `CUDA_ARCHITECTURES is set to "native", but no NVIDIA GPU was detected` during pip builds.
*   **Solution:** Bypassed architecture auto-detection by explicitly identifying the local graphics hardware (NVIDIA GeForce RTX 4060 Laptop GPU, Compute Capability 89) and hardcoding `-DCMAKE_CUDA_ARCHITECTURES=89`.

### 7.3 Long Compilation Times & Deployment Alternative
*   **Issue:** Compiling the complex templated CUDA kernels of `llama.cpp` locally from source on a laptop was slow and resource-intensive.
*   **Solution:** Canceled the local Python compilation task and utilized the pre-compiled Ollama service. Created an alternative lightweight Python chat client (`test_gguf_inference.py`) that interacts with Ollama's HTTP API, achieving GPU acceleration instantly.

### 7.4 Qwen Tokenizer Bug
*   **Issue:** GGUF conversion scripts failed with a JSON parser crash when reading `tokenizer_config.json`. This was caused by the tokenizer configuration storing `extra_special_tokens` as a list rather than a dictionary.
*   **Solution:** Integrated a Python patch in the enhanced `export_gguf.sh` script to parse the configuration file and remove the invalid field before initiating the GGUF conversion tool.

---

## 8. Deployment & Operations

Ulysses is deployed via the following workflow:

1.  **LoRA Weight Merging:**
    ```bash
    python scripts/merge.py \
      --base_model Qwen/Qwen2.5-Coder-7B \
      --adapter_dir outputs/sft_qlora_adapter \
      --output_dir outputs/final_devops_model
    ```
2.  **GGUF Export & Quantization:**
    Runs `scripts/export_gguf.sh` which compiles the conversion utilities, cleans the tokenizer configuration, converts weights to FP16 GGUF, and quantizes it to 4-bit (`devops_model_q4_k_m.gguf`).
3.  **Ollama Registration:**
    Imports the quantized file via a custom `Modelfile` containing the ChatML structure and system instructions:
    ```bash
    ollama create Ulysses -f Modelfile
    ollama run Ulysses
    ```

---

## 9. Future Work

*   **Expanded Context Support:** Optimize hyperparameters to support the full 32,768 token limit of the Qwen2.5-Coder architecture.
*   **Continuous SFT Generation:** Increase the size of the conversational training set by feeding additional documentation files to the SFT generation script.
*   **Evaluation Benchmarks:** Implement automated pipeline evaluation tests to measure the model's accuracy on code syntax generation and task planning.
