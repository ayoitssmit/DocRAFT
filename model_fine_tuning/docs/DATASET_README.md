---
license: apache-2.0
language:
- en
tags:
- devops
- kubernetes
- docker
- ci-cd
- instruction-tuning
- chatml
- sft
- qlora
task_categories:
- text-generation
- question-answering
pretty_name: DevOps SFT Instruction Dataset
size_categories:
- 1K<n<10K
---

# DevOps SFT Instruction Dataset

This dataset contains **8,076 high-quality instruction-response pairs** specifically generated for fine-tuning a DevOps domain-specialized language model. It was used in the Supervised Fine-Tuning (SFT) phase of the [Ulysses](https://huggingface.co/jalpan04/Ulysses) model training pipeline.

## Dataset Description

Instructions were generated using the **Gemini API** (`gemini-2.0-flash`) and **Ollama** (`qwen2.5-coder:7b`) by feeding chunks of official DevOps documentation and GitHub repositories to an LLM prompted to produce diverse instruction-response pairs. Each API call produced 5 pairs in 5 distinct styles:

| Style | Description |
|-------|-------------|
| **Direct Command** | "Create a script to..." or "Write a Dockerfile that..." |
| **Troubleshooting** | "I'm getting this error... how do I fix it?" |
| **Conceptual** | "Explain the difference between X and Y" |
| **Refactoring** | "Here is my config. Optimize it for..." |
| **Standard How-To** | "How do I set up X with Y?" |

## Data Format

Each record is a JSON object with a `messages` array following the **ChatML format**:

```json
{
  "messages": [
    {"role": "system", "content": "You are an expert DevOps AI."},
    {"role": "user", "content": "<question or instruction>"},
    {"role": "assistant", "content": "<detailed response>"}
  ]
}
```

## Topics Covered

The dataset covers a broad range of DevOps subjects including:

- **Docker**: Dockerfile authoring, multi-stage builds, Compose files, container networking
- **Kubernetes**: Pod, Deployment, Service, Ingress, StatefulSet, RBAC, Helm, Kustomize
- **CI/CD**: GitHub Actions, GitLab CI/CD, Jenkins pipelines, ArgoCD, FluxCD
- **Infrastructure as Code**: Terraform, Ansible, CloudFormation, Pulumi
- **Cloud Platforms**: AWS, GCP, Azure — VPCs, IAM, EKS, GKE, AKS
- **Linux & Shell**: Bash scripting, systemd, cron, networking utilities, manpages
- **Observability**: Prometheus, Grafana, ELK Stack, Loki, OpenTelemetry
- **Security**: RBAC, network policies, secrets management, container security

## Source Data

Instructions were generated from the following raw data sources:

| Source | Description |
|--------|-------------|
| `02_clean_data/github_md/` | Cleaned GitHub README and documentation files from DevOps repositories |
| `02_clean_data/manpages_clean/` | Cleaned Linux/Unix manpages for CLI tools |
| `02_clean_data/official_docs_md/` | Official documentation for Docker, Kubernetes, Terraform, Ansible, and other tools |

## Generation Details

- **LLM Providers Used**: Google Gemini (`gemini-2.0-flash`), Ollama (`qwen2.5-coder:7b`)
- **Chunks per file**: Up to 2 chunks of 15,000 characters each
- **Pairs per chunk**: 5 (multi-style)
- **Retry logic**: Up to 4 attempts with exponential backoff and 35-second cooldown on rate limits
- **Progress tracking**: Resumable generation via `.processing_progress.json`

## Usage

### Load with Hugging Face Datasets

```python
from datasets import load_dataset

dataset = load_dataset("jalpan04/devops-sft-dataset")
print(dataset["train"][0])
```

### Fine-tune with TRL SFTTrainer

```python
from datasets import load_dataset
from trl import SFTTrainer, SFTConfig
from transformers import AutoModelForCausalLM, AutoTokenizer

dataset = load_dataset("jalpan04/devops-sft-dataset", split="train")

def format_prompts(examples):
    return [tokenizer.apply_chat_template(msgs, tokenize=False) for msgs in examples["messages"]]

trainer = SFTTrainer(
    model=model,
    train_dataset=dataset,
    formatting_func=format_prompts,
    args=SFTConfig(
        output_dir="./output",
        per_device_train_batch_size=2,
        num_train_epochs=3,
    )
)
trainer.train()
```

## Associated Model

This dataset was used to train the [jalpan04/Ulysses](https://huggingface.co/jalpan04/Ulysses) model — a 7B DevOps-specialized assistant available in GGUF format for use with Ollama and llama.cpp.

## License

Apache License 2.0

## Citation

If you use this dataset, please cite:

```bibtex
@misc{devops-sft-dataset-2026,
  author = {Smit Shah and Jalpan Vyas},
  title = {DevOps SFT Instruction Dataset},
  year = {2026},
  publisher = {Hugging Face},
  howpublished = {\url{https://huggingface.co/datasets/jalpan04/devops-sft-dataset}}
}
```
