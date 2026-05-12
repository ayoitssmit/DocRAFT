"""
Docling PDF-to-Markdown converter.
Wraps the Docling DocumentConverter to provide a clean interface for the
ingestion pipeline.
"""

import logging
from pathlib import Path
from datetime import datetime, timezone

import torch
from docling.document_converter import DocumentConverter, PdfPipelineOptions
from docling.datamodel.base_models import InputFormat

from .config import MARKDOWN_OUTPUT_DIR

logger = logging.getLogger(__name__)


class DoclingConverter:
    """Converts PDF documents to structured Markdown using Docling."""

    def __init__(self, persist_markdown: bool = True):
        """
        Initialize the converter with GPU acceleration if available.

        Args:
            persist_markdown: If True, write converted Markdown to
                              data/markdown/ for inspection and debugging.
        """
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Initializing Docling with device: {device}")

        pipeline_options = PdfPipelineOptions()
        pipeline_options.device = device

        self.converter = DocumentConverter(
            format_options={
                InputFormat.PDF: pipeline_options
            }
        )
        self.persist_markdown = persist_markdown

    def convert_pdf(self, pdf_path: str | Path) -> dict:
        """
        Convert a single PDF file to Markdown.

        Args:
            pdf_path: Path to the PDF file.

        Returns:
            dict with keys: filename, markdown, converted_at
        """
        pdf_path = Path(pdf_path)
        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF not found: {pdf_path}")

        logger.info(f"Converting PDF: {pdf_path.name}")
        result = self.converter.convert(str(pdf_path))
        markdown = result.document.export_to_markdown()
        converted_at = datetime.now(timezone.utc).isoformat()

        logger.info(
            f"Converted {pdf_path.name}: {len(markdown)} chars of Markdown"
        )

        # Optionally persist for debugging
        if self.persist_markdown:
            self._persist(pdf_path.stem, markdown)

        return {
            "filename": pdf_path.name,
            "markdown": markdown,
            "converted_at": converted_at,
        }

    def convert_directory(self, dir_path: str | Path) -> list[dict]:
        """
        Convert all PDF files in a directory.

        Args:
            dir_path: Path to directory containing PDF files.

        Returns:
            List of dicts, each with keys: filename, markdown, converted_at
        """
        dir_path = Path(dir_path)
        if not dir_path.is_dir():
            raise NotADirectoryError(f"Not a directory: {dir_path}")

        pdf_files = sorted(dir_path.glob("*.pdf"))
        if not pdf_files:
            logger.warning(f"No PDF files found in {dir_path}")
            return []

        logger.info(f"Found {len(pdf_files)} PDF(s) in {dir_path}")
        results = []
        for pdf in pdf_files:
            try:
                result = self.convert_pdf(pdf)
                results.append(result)
            except Exception as e:
                logger.error(f"Failed to convert {pdf.name}: {e}")

        logger.info(
            f"Successfully converted {len(results)}/{len(pdf_files)} PDFs"
        )
        return results

    def _persist(self, stem: str, markdown: str) -> None:
        """Write Markdown to data/markdown/ for debugging inspection."""
        MARKDOWN_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        out_path = MARKDOWN_OUTPUT_DIR / f"{stem}.md"
        out_path.write_text(markdown, encoding="utf-8")
        logger.info(f"Persisted Markdown to {out_path}")
