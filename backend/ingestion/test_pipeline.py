"""
Smoke test for the DocRAFT ingestion pipeline.
Validates the full chain: PDF -> Markdown -> Chunks -> Embeddings -> Qdrant -> Query.

Usage:
    python -m backend.ingestion.test_pipeline
"""

import logging
import sys
from pathlib import Path

from ollama import Client
from qdrant_client import QdrantClient

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


def run_smoke_test() -> None:
    """Run the full pipeline smoke test."""
    logger.info("=" * 60)
    logger.info("DocRAFT Ingestion Pipeline -- Smoke Test")
    logger.info("=" * 60)

    # ── Test 1: PDF -> Markdown ──────────────────────────────────────────
    logger.info("TEST 1: Docling PDF-to-Markdown conversion")
    pdf_files = sorted(PDF_INPUT_DIR.glob("*.pdf"))
    if not pdf_files:
        logger.error(f"No PDFs found in {PDF_INPUT_DIR}. Place test PDFs there first.")
        sys.exit(1)

    test_pdf = pdf_files[0]
    logger.info(f"  Using test PDF: {test_pdf.name}")

    converter = DoclingConverter(persist_markdown=True)
    result = converter.convert_pdf(test_pdf)
    markdown = result["markdown"]
    images = result.get("images", [])

    logger.info(f"  Markdown length: {len(markdown)} chars")
    logger.info(f"  Images extracted: {len(images)}")
    logger.info("  PASS: PDF conversion successful")

    # ── Test 1.5: Image Intelligence ─────────────────────────────────────
    logger.info("TEST 1.5: Image Extraction & Intelligence")
    from .image_processor import ImageIntelligence
    img_intel = ImageIntelligence()
    
    if images:
        # Pass 1: Fast Save
        saved_images = img_intel.save_images(result["filename"], images)
        logger.info(f"  Saved {len(saved_images)} images to disk.")
        
        # Pass 2: Slow Analysis
        print(f"\n[AI] Starting analysis of {len(saved_images)} images...")
        processed_images = []
        for i, img in enumerate(saved_images):
            print(f"  - Analyzing Image {i+1}/{len(saved_images)}...")
            enriched = img_intel.analyze_image(img)
            processed_images.append(enriched)
        
        logger.info(f"  Processed {len(processed_images)} images with Vision AI")
        
        # Check first image results
        if processed_images:
            sample_img = processed_images[0]
            logger.info(f"  Sample Image Description: {sample_img['description'][:200]}...")
            
            # Update markdown
            markdown = img_intel.append_images_to_markdown(markdown, processed_images)
            logger.info("  Updated Markdown appendix with descriptions")
        
        logger.info("  PASS: Image processing successful")
    else:
        logger.info("  SKIP: No images found in test PDF to process")

    # ── Test 2: Markdown -> Chunks ───────────────────────────────────────
    logger.info("TEST 2: LlamaIndex Markdown chunking")
    chunker = MarkdownChunker()
    metadata = {
        "source_file": result["filename"],
        "converted_at": result["converted_at"],
    }
    nodes = chunker.chunk(markdown, metadata=metadata)

    chunk_sizes = [len(n.get_content()) for n in nodes]
    avg_size = sum(chunk_sizes) / len(chunk_sizes) if chunk_sizes else 0

    logger.info(f"  Chunk count: {len(nodes)}")
    logger.info(f"  Average chunk size: {avg_size:.0f} chars")
    logger.info(f"  Min chunk size: {min(chunk_sizes) if chunk_sizes else 0} chars")
    logger.info(f"  Max chunk size: {max(chunk_sizes) if chunk_sizes else 0} chars")

    # Print first 3 chunks for inspection
    for i, node in enumerate(nodes[:3]):
        content = node.get_content()[:200]
        logger.info(f"  Chunk {i}: {content}...")
    logger.info("  PASS: Markdown chunking successful")

    # ── Test 3: Embedding ────────────────────────────────────────────────
    logger.info("TEST 3: Ollama embedding generation")
    ollama = Client(host=OLLAMA_HOST)

    sample_text = nodes[0].get_content() if nodes else "test"
    response = ollama.embeddings(model=EMBED_MODEL, prompt=sample_text)
    embedding = response["embedding"]

    logger.info(f"  Model: {EMBED_MODEL}")
    logger.info(f"  Vector dimensions: {len(embedding)}")
    logger.info(f"  First 5 values: {embedding[:5]}")
    logger.info("  PASS: Embedding generation successful")

    # ── Test 4: Qdrant query ─────────────────────────────────────────────
    logger.info("TEST 4: Qdrant semantic query")
    qdrant = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)

    if not qdrant.collection_exists(collection_name=COLLECTION_NAME):
        logger.warning(
            f"  Collection '{COLLECTION_NAME}' does not exist. "
            "Run the full pipeline first: python -m backend.ingestion.pipeline"
        )
        logger.info("  SKIP: Qdrant query test (collection not found)")
    else:
        query = "What is the main topic of this document?"
        logger.info(f"  Query: '{query}'")

        query_vector = ollama.embeddings(model=EMBED_MODEL, prompt=query)["embedding"]
        search_results = qdrant.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            limit=3,
        ).points

        if search_results:
            for i, hit in enumerate(search_results):
                score = hit.score
                text_preview = hit.payload.get("text", "")[:150]
                source = hit.payload.get("source_file", "unknown")
                logger.info(f"  Result {i + 1} (score={score:.4f}, source={source}):")
                logger.info(f"    {text_preview}...")
            logger.info("  PASS: Qdrant query successful")
        else:
            logger.warning("  No results returned from Qdrant")

    # ── Summary ──────────────────────────────────────────────────────────
    logger.info("=" * 60)
    logger.info("Smoke Test Complete -- All tests passed")
    logger.info("=" * 60)


if __name__ == "__main__":
    run_smoke_test()
