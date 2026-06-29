---
license: apache-2.0
base_model: Qwen/Qwen2.5-Coder-7B
language:
- en
tags:
- devops
- kubernetes
- docker
- ci-cd
- gguf
- qlora
- sre
- llama-cpp
- ollama
datasets:
- jalpan04/devops-sft-dataset
pipeline_tag: text-generation
---

# Ulysses — Domain-Specialized DevOps AI Assistant (7B)

**Authors:** Jalpan Vyas & Smit Shah 

> Just as Odysseus (Ulysses) piloted his raft through dangerous seas guided by hard-won knowledge, this model navigates complex DevOps questions anchored to real documentation, code, and system knowledge — not guesswork.

---

## Model Summary

Ulysses is a 7B-parameter large language model, fine-tuned from [Qwen/Qwen2.5-Coder-7B](https://huggingface.co/Qwen/Qwen2.5-Coder-7B) using a two-phase QLoRA + RAFT-inspired pipeline. It is purpose-built for DevOps, Site Reliability Engineering (SRE), and systems engineering tasks.

**Training was performed in two distinct phases:**

| Phase | Type | Purpose | Data |
|-------|------|---------|------|
| **CPT** | Continued Pre-Training (LoRA, BF16) | Taught the model DevOps domain vocabulary, concepts, and patterns from raw documentation | 467 MB plain-text corpus (docs, manpages, GitHub READMEs, code scripts) |
| **SFT** | Supervised Fine-Tuning (QLoRA, 4-bit NF4) | Taught the model to follow instructions and respond in the ChatML conversational format | 8,076 instruction-response pairs in ChatML format |

After both phases, the LoRA adapters were merged back into the base model, then exported and quantized to GGUF format using `llama.cpp`.

---

## Model Files

| File | Size | Description |
|------|------|-------------|
| `devops_model_q4_k_m.gguf` | ~4.7 GB | **Recommended.** 4-bit Q4_K_M quantized. Best balance of speed, memory, and quality. Runs on 8 GB RAM/VRAM. |
| `devops_model_f16.gguf` | ~14 GB | Full 16-bit precision. Maximum accuracy. Requires ~16 GB RAM/VRAM. |

---

## Intended Use

- **Containerization**: Writing, optimizing, and debugging Dockerfiles, Compose files, and container security profiles.
- **Orchestration**: Generating and validating Kubernetes manifests, Helm charts, and Kustomize configurations.
- **CI/CD Automation**: Writing GitHub Actions, GitLab CI/CD, and Jenkins pipelines.
- **Infrastructure as Code (IaC)**: Writing Terraform configurations, Ansible playbooks, and CloudFormation templates.
- **Shell & Scripting**: Automating administrative tasks with Bash, Python, and PowerShell.
- **Troubleshooting**: Explaining Linux error messages, diagnosing system bottlenecks, and interpreting logs.
- **Security**: Generating security policies, RBAC manifests, and network security group rules.

---

## How to Run

### 1. Ollama (Recommended — GPU-accelerated, no setup required)

Create a file named `Modelfile`:

```dockerfile
FROM ./devops_model_q4_k_m.gguf

TEMPLATE """{{- if .System }}<|im_start|>system
{{ .System }}<|im_end|>
{{- end }}
{{- range .Messages }}
{{- if eq .Role "user" }}<|im_start|>user
{{ .Content }}<|im_end|>
{{- else if eq .Role "assistant" }}<|im_start|>assistant
{{ .Content }}<|im_end|>
{{- end }}
{{- end }}<|im_start|>assistant
"""

SYSTEM """You are an expert DevOps assistant. You have deep domain knowledge of Docker, Kubernetes, CI/CD pipelines, cloud infrastructure, and software engineering. Provide accurate, clear, and structured technical responses."""

PARAMETER temperature 0.3
PARAMETER top_p 0.9
```

Then run:
```bash
ollama create Ulysses -f Modelfile
ollama run Ulysses
```

---

### 2. Python via Ollama REST API

```python
import json, requests

def chat(prompt):
    response = requests.post("http://localhost:11434/api/chat", json={
        "model": "Ulysses",
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "options": {"temperature": 0.3, "top_p": 0.9}
    })
    return response.json()['message']['content']

print(chat("Write a Dockerfile for a multi-stage Go application."))
```

---

### 3. llama-cpp-python (Direct GGUF Loading)

> **Important:** You must install the GPU-enabled version of `llama-cpp-python`. The default CPU build will be extremely slow on large models.

```bash
# CUDA 12.2 (adjust for your version)
pip install llama-cpp-python --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cu122
```

```python
from llama_cpp import Llama

llm = Llama(
    model_path="path/to/devops_model_q4_k_m.gguf",
    n_gpu_layers=-1,      # Offload all layers to GPU
    n_ctx=2048,
    chat_format="chatml", # Required for correct formatting
    verbose=False
)

response = llm.create_chat_completion(
    messages=[
        {"role": "system", "content": "You are an expert DevOps assistant."},
        {"role": "user", "content": "Explain the difference between a Kubernetes Pod and a Deployment."}
    ],
    max_tokens=512,
    temperature=0.3,
    top_p=0.9,
    stream=True
)

for chunk in response:
    delta = chunk['choices'][0]['delta']
    if 'content' in delta:
        print(delta['content'], end="", flush=True)
```

---

## Prompt Template (ChatML)

This model uses the **ChatML format**. Always wrap prompts as follows for optimal results:

```
<|im_start|>system
You are an expert DevOps assistant.<|im_end|>
<|im_start|>user
{your_question_here}<|im_end|>
<|im_start|>assistant
```

---

## Training Details

### Phase 1: Continued Pre-Training (CPT)

| Parameter | Value |
|-----------|-------|
| Base Model | `Qwen/Qwen2.5-Coder-7B` (7.6B parameters) |
| Method | LoRA in BF16 (full-precision base) |
| LoRA Rank (r) | 16 |
| LoRA Alpha | 32 (effective scaling = 2.0) |
| LoRA Dropout | 0.05 |
| Target Modules | q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj |
| Trainable Parameters | 40,370,176 (0.53% of total) |
| Block Size | 512 tokens |
| Batch Size | 16 per device |
| Gradient Accumulation | 4 steps (effective batch = 64) |
| Learning Rate | 2e-4 |
| LR Scheduler | Cosine with 3% warmup |
| Weight Decay | 0.01 |
| Epochs | 1 |
| Precision | BF16 |
| Gradient Checkpointing | Enabled |
| Training Duration | ~13.4 hours on NVIDIA A100 80GB |
| Total Steps | 3,085 |
| Dataset Size | 197,393 context blocks of 512 tokens |

**CPT Corpus contents (467 MB total):**
- GitHub README files from DevOps repositories
- Official documentation for Docker, Kubernetes, Terraform, Ansible, CI/CD tools
- Cleaned Linux/Unix manpages
- Code scripts (Bash, Python, YAML, Dockerfile) with repository metadata

### Phase 2: Supervised Fine-Tuning (SFT)

| Parameter | Value |
|-----------|-------|
| Base Model | CPT-merged model (`outputs/merged_devops_model`) |
| Method | QLoRA (4-bit NF4 + double quantization) |
| LoRA Rank (r) | 16 |
| LoRA Alpha | 32 |
| LoRA Dropout | 0.05 |
| Target Modules | q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj |
| Max Sequence Length | 4096 tokens |
| Batch Size | 4 per device |
| Gradient Accumulation | 16 steps (effective batch = 64) |
| Learning Rate | 2e-5 (10x lower than CPT to prevent catastrophic forgetting) |
| LR Scheduler | Cosine with 3% warmup |
| Epochs | 3 |
| Attention | Flash Attention 2 (with SDPA fallback) |
| Quantization | 4-bit NF4 with double quantization, BF16 compute |
| Dataset | 8,076 ChatML instruction-response pairs |

**SFT instruction styles include:**
- Direct Command ("Create a script to...")
- Troubleshooting (diagnosing and fixing errors)
- Conceptual ("Explain the difference between...")
- Refactoring (optimizing and improving existing code/config)
- Standard How-To ("How do I...")

### Post-Training: GGUF Export

After both training phases, the adapters were merged into the base model and converted to GGUF format:

1. `merge_and_unload()` — merged LoRA weights into base model weights: `W_merged = W_base + (alpha/r) × A × B`
2. `convert_hf_to_gguf.py` — converted HF model to FP16 GGUF (`devops_model_f16.gguf`)
3. `llama-quantize` — quantized to Q4_K_M 4-bit (`devops_model_q4_k_m.gguf`)

> A known `extra_special_tokens` bug in the Qwen2 tokenizer's `tokenizer_config.json` (stored as a list instead of a dict) was patched before conversion, as `convert_hf_to_gguf.py` expects a dictionary.

---

## Training Data

The training datasets are published separately on Hugging Face:

- **[jalpan04/devops-sft-dataset](https://huggingface.co/datasets/jalpan04/devops-sft-dataset)** — 8,076 DevOps instruction-response pairs in ChatML format, generated using the Gemini API and Ollama over official documentation, GitHub repositories, and manpages. Used for SFT.

The CPT corpus (467 MB plain text) consists of publicly available documentation and open-source code.

---

## Hardware Requirements for Inference

| Format | Min VRAM | Min RAM | Description |
|--------|----------|---------|-------------|
| `devops_model_q4_k_m.gguf` | 4 GB | 8 GB | Q4_K_M quantized — runs on consumer laptops |
| `devops_model_f16.gguf` | 16 GB | 16 GB | Full FP16 — server or high-end workstation |

---

## Limitations and Safety

- **Validation Required**: Always test generated scripts, manifests, and commands in a non-production sandbox. Do not execute destructive commands (e.g., `rm -rf`, cluster resets) without manual review.
- **Hallucinations**: While the two-phase RAFT-inspired training reduces hallucinations, the model can occasionally generate incorrect package versions or outdated syntax for niche tools.
- **Knowledge Cutoff**: Training data has a knowledge cutoff. Very recent tool versions or APIs may not be reflected.
- **Not a Security Tool**: Security configurations generated by this model should be reviewed by a qualified security engineer before production use.

---

## License

This model is released under the **Apache License 2.0**, consistent with the base model (Qwen2.5-Coder-7B). You are free to use, modify, and distribute this model for both commercial and non-commercial purposes, subject to the attribution requirements of the license.
