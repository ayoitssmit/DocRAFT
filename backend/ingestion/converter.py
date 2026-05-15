"""
Docling PDF-to-Markdown converter.
Wraps the Docling DocumentConverter to provide a clean interface for the
ingestion pipeline.
"""

import logging
from pathlib import Path
from datetime import datetime, timezone

import torch
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.pipeline_options import PdfPipelineOptions, AcceleratorOptions
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
        self.device = device
        print(f"[STEP] Initializing Docling Converter")
        print(f"[INFO] Using device: {device.upper()}")
        if device == "cuda":
            print(f"[INFO] GPU Model detected: {torch.cuda.get_device_name(0)}")
        
        # Configure pipeline for memory efficiency
        pipeline_options = PdfPipelineOptions()
        pipeline_options.do_ocr = True
        pipeline_options.do_table_structure = True
        
        # Reduced scale to save VRAM on dense PDFs
        pipeline_options.images_scale = 1.5 
        pipeline_options.generate_picture_images = True
        pipeline_options.generate_page_images = True  # Required to crop tables as images
        
        # Disable thresholds to capture all bitmap elements
        try:
            if hasattr(pipeline_options.ocr_options, 'bitmap_area_threshold'):
                pipeline_options.ocr_options.bitmap_area_threshold = 0.0
        except Exception:
            pass
        # Set accelerator options with slightly fewer threads to stabilize memory
        pipeline_options.accelerator_options = AcceleratorOptions(
            num_threads=4, device=self.device
        )

        self.converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
            }
        )
        self.persist_markdown = persist_markdown
        print(f"[SUCCESS] Docling initialized (Memory-optimized)")

    def convert_pdf(self, pdf_path: str | Path, original_filename: str | None = None) -> dict:
        """
        Convert a single PDF file to Markdown and extract images.

        Args:
            pdf_path: Path to the PDF file.
            original_filename: The actual name of the file (to avoid temp names).

        Returns:
            dict with keys: filename, markdown, converted_at, images
        """
        pdf_path = Path(pdf_path)
        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF not found: {pdf_path}")

        display_name = original_filename or pdf_path.name
        print(f"[STEP] Converting PDF: {display_name}")
        logger.info(f"Converting PDF: {display_name}")
        
        result = self.converter.convert(str(pdf_path))
        markdown = result.document.export_to_markdown()
        converted_at = datetime.now(timezone.utc).isoformat()

        # Extract images (pictures) from the document
        images = []
        for idx, picture in enumerate(result.document.pictures):
            # Docling provides the image through the document object
            try:
                image_data = picture.get_image(result.document)
                if image_data:
                    # Capture page number (prov is a list of provenance entries)
                    page_no = picture.prov[0].page_no if picture.prov else 0
                    images.append({
                        "index": f"pic_{idx}",
                        "image": image_data,  # PIL Image
                        "page": page_no,
                    })
            except Exception as e:
                logger.warning(f"Failed to extract picture {idx} from {pdf_path.name}: {e}")

        # Extract tables as images (since many technical diagrams are parsed as tables)
        for idx, table in enumerate(result.document.tables):
            try:
                image_data = table.get_image(result.document)
                if image_data:
                    page_no = table.prov[0].page_no if table.prov else 0
                    images.append({
                        "index": f"tab_{idx}",
                        "image": image_data,
                        "page": page_no,
                    })
            except Exception as e:
                logger.warning(f"Failed to extract table {idx} from {pdf_path.name}: {e}")

        print(f"[SUCCESS] Conversion complete ({len(markdown)} characters, {len(images)} images found)")
        logger.info(
            f"Converted {display_name}: {len(markdown)} chars, {len(images)} images"
        )

        # Optionally persist for debugging
        if self.persist_markdown:
            # Use display_name stem for the markdown file
            self._persist(Path(display_name).stem, markdown)

        return {
            "filename": display_name,
            "markdown": markdown,
            "converted_at": converted_at,
            "images": images,
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
