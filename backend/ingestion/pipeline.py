"""
DocRAFT Ingestion Pipeline.
End-to-end orchestrator: PDF -> Markdown -> Chunks -> Embeddings -> Qdrant.

Usage:
    python -m backend.ingestion.pipeline
    python -m backend.ingestion.pipeline --pdf-dir data/pdfs/
"""

import argparse
import logging
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from ollama import Client
from qdrant_client import QdrantClient
from qdrant_client.http import models

from .config import (
    COLLECTION_NAME,
    EMBED_MODEL,
    OLLAMA_HOST,
    PDF_INPUT_DIR,
    QDRANT_HOST,
    QDRANT_PORT,
)
from .converter import DoclingConverter
from .chunker import MarkdownChunker

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


def _init_collection(
    qdrant: QdrantClient, collection_name: str, vector_size: int
) -> None:
    """Ensure the Qdrant collection exists."""
    if qdrant.collection_exists(collection_name=collection_name):
        logger.info(f"Collection '{collection_name}' already exists. Skipping creation.")
        return

    qdrant.create_collection(
        collection_name=collection_name,
        vectors_config=models.VectorParams(
            size=vector_size, distance=models.Distance.COSINE
        ),
    )
    logger.info(f"Created collection '{collection_name}' (dim={vector_size})")


def run_ingestion(pdf_dir: str | Path | None = None, pdf_file: str | Path | None = None) -> dict:
    """
    Full ingestion pipeline: PDF -> Markdown -> Chunks -> Embeddings -> Qdrant.

    Args:
        pdf_dir: Path to directory containing PDFs.
        pdf_file: Path to a specific PDF file.

    Returns:
        Summary dict with stats about the ingestion run.
    """
    if pdf_file:
        input_path = Path(pdf_file)
        if not input_path.exists():
            logger.error(f"File not found: {pdf_file}")
            return {"status": "error", "reason": "file_not_found"}
        logger.info(f"Processing single file: {pdf_file}")
        # We still need a dir for Docling converter in current impl, 
        # or we modify converter. Let's just pass the file path.
    else:
        pdf_dir = Path(pdf_dir) if pdf_dir else PDF_INPUT_DIR
        pdf_dir.mkdir(parents=True, exist_ok=True)
        input_path = pdf_dir

    logger.info("=" * 60)
    logger.info("DocRAFT Ingestion Pipeline")
    logger.info("=" * 60)

    # ── Step 1: Convert PDFs to Markdown ─────────────────────────────────
    print("\n" + "="*30)
    print("STEP 1: Document Conversion")
    print("="*30)
    logger.info("STEP 1: Converting PDFs to Markdown via Docling")
    converter = DoclingConverter(persist_markdown=True)
    
    if pdf_file:
        converted_docs = [converter.convert_pdf(input_path)]
    else:
        converted_docs = converter.convert_directory(input_path)

    if not converted_docs:
        logger.error(f"No PDFs found in {pdf_dir}. Aborting.")
        return {"status": "error", "reason": "no_pdfs_found"}

    # ── Step 1.5: Image Extraction (Fast) ────────────────────────────────
    print("\n" + "="*30)
    print("STEP 1.5: Image Extraction")
    print("="*30)
    from .image_processor import ImageIntelligence
    img_intel = ImageIntelligence()
    
    for doc in converted_docs:
        if "images" in doc and doc["images"]:
            # Pass 1: Just save to disk
            saved_meta = img_intel.save_images(doc["filename"], doc["images"])
            doc["image_metadata"] = saved_meta
        else:
            doc["image_metadata"] = []

    # ── Step 2: Chunk Markdown ───────────────────────────────────────────
    print("\n" + "="*30)
    print("STEP 2: Semantic Chunking")
    print("="*30)
    logger.info("STEP 2: Chunking Markdown via LlamaIndex MarkdownNodeParser")
    chunker = MarkdownChunker()
    chunked_docs = chunker.chunk_batch(converted_docs)

    # Flatten all nodes for embedding
    all_nodes = []
    for doc in chunked_docs:
        for i, node in enumerate(doc["nodes"]):
            all_nodes.append({
                "text": node.get_content(),
                "metadata": {
                    **node.metadata,
                    "chunk_index": i,
                    "total_chunks": doc["node_count"],
                    "source_file": doc["filename"],
                    "content_type": "text"
                },
            })

    # ── Step 3: Generate Embeddings & Qdrant Points ──────────────────────
    print("\n" + "="*30)
    print("STEP 3: Vector Embedding & AI Analysis")
    print("="*30)
    logger.info("STEP 3: Generating embeddings and running Vision AI")
    ollama_client = Client(host=OLLAMA_HOST)

    # Auto-detect vector dimensions
    sample_embed = ollama_client.embeddings(model=EMBED_MODEL, prompt="test")["embedding"]
    vector_size = len(sample_embed)
    logger.info(f"Embedding model: {EMBED_MODEL}, vector dimensions: {vector_size}")

    points = []
    
    # 3.1: Embed Text Chunks (Fast)
    logger.info(f"Embedding {len(all_nodes)} text chunks...")
    for idx, chunk in enumerate(all_nodes):
        try:
            response = ollama_client.embeddings(model=EMBED_MODEL, prompt=chunk["text"])
            embedding = response["embedding"]

            points.append(
                models.PointStruct(
                    id=str(uuid.uuid4()),
                    vector=embedding,
                    payload={
                        "text": chunk["text"],
                        "source_file": chunk["metadata"].get("source_file", "unknown"),
                        "chunk_index": chunk["metadata"].get("chunk_index", 0),
                        "total_chunks": chunk["metadata"].get("total_chunks", 0),
                        "content_type": "text",
                        "ingested_at": datetime.now(timezone.utc).isoformat(),
                    },
                )
            )
        except Exception as e:
            logger.error(f"Failed to embed chunk {idx} (length {len(chunk['text'])}): {e}")
            logger.error(f"Snippet: {chunk['text'][:100]}...")
            continue

    # 3.2: Image Intelligence (Slow - One by One)
    total_images = sum(len(doc.get("image_metadata", [])) for doc in converted_docs)
    if total_images > 0:
        print(f"\n[AI] Analyzing {total_images} images with Vision AI and OCR...")
        for doc in converted_docs:
            processed_for_doc = []
            for i, img_info in enumerate(doc.get("image_metadata", [])):
                print(f"  [Thinking] Analyzing Image {i+1}/{len(doc['image_metadata'])} from {doc['filename']}...")
                
                # RUN SLOW ANALYSIS
                enriched_img = img_intel.analyze_image(img_info)
                processed_for_doc.append(enriched_img)

                # Embed the "combined_text"
                response = ollama_client.embeddings(model=EMBED_MODEL, prompt=enriched_img["combined_text"])
                points.append(
                    models.PointStruct(
                        id=str(uuid.uuid4()),
                        vector=response["embedding"],
                        payload={
                            "text": enriched_img["combined_text"],
                            "source_file": doc["filename"],
                            "content_type": "image",
                            "image_path": enriched_img["path"],
                            "page_no": enriched_img["page"],
                            "description": enriched_img["description"],
                            "ingested_at": datetime.now(timezone.utc).isoformat(),
                        },
                    )
                )
            
            # Update Markdown and re-persist with descriptions
            doc["markdown"] = img_intel.append_images_to_markdown(doc["markdown"], processed_for_doc)
            converter._persist(Path(doc["filename"]).stem, doc["markdown"])

    if not points:
        logger.error("No points generated. Aborting.")
        return {"status": "error", "reason": "no_data_to_store"}

    # ── Step 4: Upsert to Qdrant ─────────────────────────────────────────
    print("\n" + "="*30)
    print("STEP 4: Qdrant Storage")
    print("="*30)
    logger.info(f"STEP 4: Upserting {len(points)} total points to Qdrant")
    qdrant = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
    _init_collection(qdrant, COLLECTION_NAME, vector_size)

    # Batch upsert in groups of 100
    batch_size = 100
    for i in range(0, len(points), batch_size):
        batch = points[i : i + batch_size]
        qdrant.upsert(collection_name=COLLECTION_NAME, points=batch)
        logger.info(f"  Upserted batch {i // batch_size + 1} ({len(batch)} points)")

    # ── Summary ──────────────────────────────────────────────────────────
    summary = {
        "status": "success",
        "pdfs_converted": len(converted_docs),
        "total_chunks": len(all_nodes),
        "vector_dimensions": vector_size,
        "collection": COLLECTION_NAME,
    }

    logger.info("=" * 60)
    logger.info("Ingestion Complete")
    for key, val in summary.items():
        logger.info(f"  {key}: {val}")
    logger.info("=" * 60)

    return summary


def main() -> None:
    """CLI entrypoint for the ingestion pipeline."""
    parser = argparse.ArgumentParser(
        description="DocRAFT Ingestion Pipeline: PDF -> Markdown -> Chunks -> Qdrant"
    )
    parser.add_argument(
        "--pdf-dir",
        type=str,
        default=None,
        help=f"Directory containing PDF files (default: {PDF_INPUT_DIR})",
    )
    parser.add_argument(
        "--pdf-file",
        type=str,
        default=None,
        help="Path to a specific PDF file to process",
    )
    args = parser.parse_args()
    run_ingestion(pdf_dir=args.pdf_dir, pdf_file=args.pdf_file)


if __name__ == "__main__":
    main()
