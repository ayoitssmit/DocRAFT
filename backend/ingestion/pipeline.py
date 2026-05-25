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
import re
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
from .embedder import DocRAFTEmbedder

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

def clean_markdown(md_text: str) -> str:
    """
    Strips out noisy sections like 'Table of Contents' and 'List of Figures'.
    Also removes common page headers/footers.
    """
    # Remove Table of Contents
    md_text = re.sub(r'(?i)(?:##|#)\s*(?:Table of Contents).*?(?=(?:##|#) |\Z)', '', md_text, flags=re.DOTALL)
    
    # Remove List of Figures / Tables
    md_text = re.sub(r'(?i)(?:##|#)\s*(?:List of Figures|List of Tables).*?(?=(?:##|#) |\Z)', '', md_text, flags=re.DOTALL)
    
    return md_text


def _init_collection(
    qdrant: QdrantClient, collection_name: str, vector_size: int
) -> None:
    """Ensure the Qdrant collection exists and matches the required dimensions."""
    if qdrant.collection_exists(collection_name=collection_name):
        # Check current dimension
        info = qdrant.get_collection(collection_name=collection_name)
        # Handle both VectorParams and dict response formats
        current_params = info.config.params.vectors
        if hasattr(current_params, 'size'):
            current_dim = current_params.size
        else:
            current_dim = current_params['size']
            
        if current_dim == vector_size:
            logger.info(f"Collection '{collection_name}' already exists with correct dim={vector_size}.")
            return
        else:
            logger.warning(
                f"Collection '{collection_name}' has dim={current_dim}, but model requires dim={vector_size}. "
                "Recreating collection..."
            )
            qdrant.delete_collection(collection_name=collection_name)

    qdrant.create_collection(
        collection_name=collection_name,
        vectors_config=models.VectorParams(
            size=vector_size, distance=models.Distance.COSINE
        ),
    )
    logger.info(f"Created collection '{collection_name}' (dim={vector_size})")


def run_ingestion(
    pdf_dir: str | Path | None = None, 
    pdf_file: str | Path | None = None,
    qdrant_client: QdrantClient | None = None,
    original_filename: str | None = None
) -> dict:
    """
    Full ingestion pipeline: PDF -> Markdown -> Chunks -> Embeddings -> Qdrant.

    Args:
        pdf_dir: Path to directory containing PDFs.
        pdf_file: Path to a specific PDF file.
        qdrant_client: Optional existing QdrantClient instance (to avoid file lock).
        original_filename: The actual display name of the file (to avoid temp names).

    Returns:
        Summary dict with stats about the ingestion run.
    """
    if pdf_file:
        input_path = Path(pdf_file)
        if not input_path.exists():
            logger.error(f"File not found: {pdf_file}")
            return {"status": "error", "reason": "file_not_found"}
        logger.info(f"Processing single file: {pdf_file} (Original: {original_filename or 'Unknown'})")
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
        converted_docs = [converter.convert_pdf(input_path, original_filename=original_filename)]
    else:
        converted_docs = converter.convert_directory(input_path)

    if not converted_docs:
        logger.error(f"No PDFs found in {pdf_dir}. Aborting.")
        return {"status": "error", "reason": "no_pdfs_found"}

    # ── Step 1.5: Image Extraction & Intelligence ────────────────────────
    print("\n" + "="*30)
    print("STEP 1.5: Image Extraction & Intelligence")
    print("="*30)
    from .image_processor import ImageIntelligence
    img_intel = ImageIntelligence()
    
    image_points_payloads = []
    
    for doc in converted_docs:
        if "images" in doc and doc["images"]:
            # Pass 1: Just save to disk
            saved_meta = img_intel.save_images(doc["filename"], doc["images"])
            doc["image_metadata"] = saved_meta
        else:
            doc["image_metadata"] = []
            
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

                # Store for embedding later
                image_points_payloads.append({
                    "combined_text": enriched_img["combined_text"],
                    "display_text": enriched_img.get("display_text", enriched_img["combined_text"]),
                    "source_file": doc["filename"],
                    "image_path": enriched_img["path"],
                    "page_no": enriched_img["page"],
                    "description": enriched_img["description"],
                })
            
            # Update Markdown and re-persist with descriptions
            doc["markdown"] = img_intel.inject_images_into_markdown(doc["markdown"], processed_for_doc)
            converter._persist(Path(doc["filename"]).stem, doc["markdown"])

    # ── Step 1.8: Clean Markdown ─────────────────────────────────────────
    print("\n" + "="*30)
    print("STEP 1.8: Markdown Noise Cleaning")
    print("="*30)
    logger.info("Cleaning markdown to remove Table of Contents and List of Figures...")
    for doc in converted_docs:
        doc["markdown"] = clean_markdown(doc["markdown"])

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
        # Determine display name
        display_name = original_filename if original_filename else Path(doc["filename"]).name

        for i, node in enumerate(doc["nodes"]):
            all_nodes.append({
                "text": node.get_content(),
                "metadata": {
                    **node.metadata,
                    "chunk_index": i,
                    "total_chunks": doc["node_count"],
                    "source_file": doc["filename"],
                    "source_document": display_name,
                    "image_path": None,
                    "content_type": "text"
                },
            })

    # ── Step 3: Generate Embeddings & Qdrant Points ──────────────────────
    print("\n" + "="*30)
    print("STEP 3: Vector Embedding")
    print("="*30)
    logger.info("STEP 3: Generating embeddings...")

    embedder = DocRAFTEmbedder()
    logger.info(
        f"[Pipeline] Active embedder: {embedder.model_name} "
        f"(backend={embedder.backend}, dim={embedder.vector_size})"
    )
    vector_size = embedder.vector_size

    points = []
    
    # 3.1: Embed Text Chunks (Fast)
    logger.info(f"Embedding {len(all_nodes)} text chunks with {embedder.model_name}...")
    for idx, chunk in enumerate(all_nodes):
        try:
            embedding = embedder.embed(chunk["text"])

            points.append(
                models.PointStruct(
                    id=str(uuid.uuid4()),
                    vector=embedding,
                    payload={
                        "text": chunk["text"],
                        "source_file": chunk["metadata"].get("source_file", "unknown"),
                        "source_document": chunk["metadata"].get("source_document"),
                        "image_path": chunk["metadata"].get("image_path"),
                        "chunk_index": chunk["metadata"].get("chunk_index", 0),
                        "total_chunks": chunk["metadata"].get("total_chunks", 0),
                        "content_type": "text",
                        "embed_model": embedder.model_name,
                        "ingested_at": datetime.now(timezone.utc).isoformat(),
                    },
                )
            )
        except Exception as e:
            logger.error(f"Failed to embed chunk {idx} (length {len(chunk['text'])}): {e}")
            logger.error(f"Snippet: {chunk['text'][:100]}...")
            continue

    # 3.2: Embed standalone Image Descriptions
    if image_points_payloads:
        logger.info(f"Embedding {len(image_points_payloads)} standalone image descriptions with {embedder.model_name}...")
        for payload in image_points_payloads:
            try:
                img_embedding = embedder.embed(payload["combined_text"])
                points.append(
                    models.PointStruct(
                        id=str(uuid.uuid4()),
                        vector=img_embedding,
                        payload={
                            "text": payload["combined_text"],
                            "display_text": payload.get("display_text", payload["combined_text"]),
                            "source_file": payload["source_file"],
                            "source_document": original_filename if original_filename else Path(payload["source_file"]).name,
                            "content_type": "image",
                            "image_path": payload["image_path"],
                            "page_no": payload["page_no"],
                            "description": payload["description"],
                            "embed_model": embedder.model_name,
                            "ingested_at": datetime.now(timezone.utc).isoformat(),
                        },
                    )
                )
            except Exception as e:
                logger.error(f"Failed to embed image description: {e}")
                continue

    if not points:
        logger.error("No points generated. Aborting.")
        return {"status": "error", "reason": "no_data_to_store"}

    # ── Step 4: Upsert to Qdrant ─────────────────────────────────────────
    print("\n" + "="*30)
    print("STEP 4: Qdrant Storage")
    print("="*30)
    logger.info(f"STEP 4: Upserting {len(points)} total points to Qdrant")
    
    if qdrant_client:
        qdrant = qdrant_client
    else:
        # If no client is provided, we MUST check if we are in local mode.
        # Creating a new QdrantClient(path=...) here will fail if the main app has it locked.
        if QDRANT_HOST in ["localhost", "127.0.0.1"]:
            raise RuntimeError(
                "No Qdrant client provided and local storage is likely locked by the main application. "
                "The ingestion pipeline must reuse the existing database connection."
            )
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
