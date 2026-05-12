import io
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import base64

import ollama
from PIL import Image
from .config import IMAGE_OUTPUT_DIR, VISION_MODEL

logger = logging.getLogger(__name__)

class ImageIntelligence:
    """
    Handles image extraction, OCR, and Vision AI descriptions.
    """

    def __init__(self):
        self.output_base = IMAGE_OUTPUT_DIR
        self.output_base.mkdir(parents=True, exist_ok=True)
        
        # Initialize OCR engine (RapidOCR)
        try:
            from rapidocr_onnxruntime import RapidOCR
            # We assume GPU is used if the user installed the right onnxruntime
            self.ocr_engine = RapidOCR()
            logger.info("RapidOCR initialized successfully.")
        except ImportError:
            logger.warning("RapidOCR not found. Falling back to Vision-only mode.")
            self.ocr_engine = None

    def save_images(self, pdf_name: str, images: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        PASS 1: Quickly save all extracted images to disk.
        """
        if not images:
            return []

        pdf_stem = Path(pdf_name).stem
        save_dir = self.output_base / pdf_stem
        save_dir.mkdir(parents=True, exist_ok=True)

        saved_metadata = []
        for img_info in images:
            idx = img_info["index"]
            pil_img = img_info["image"]
            page_no = img_info["page"]

            img_filename = f"image_p{page_no}_{idx}.png"
            img_path = save_dir / img_filename
            pil_img.save(img_path)
            
            saved_metadata.append({
                "index": idx,
                "path": str(img_path),
                "page": page_no,
                "pil_image": pil_img # Keep in memory for Pass 2
            })
        
        print(f"[SUCCESS] Saved {len(saved_metadata)} images to {save_dir}")
        return saved_metadata

    def _downscale(self, pil_img: Image.Image, max_px: int = 512) -> Image.Image:
        """Shrink image so longest side is max_px. Keeps aspect ratio."""
        w, h = pil_img.size
        if max(w, h) <= max_px:
            return pil_img
        scale = max_px / max(w, h)
        return pil_img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    def analyze_image(self, img_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        PASS 2: Run OCR and Vision AI on a single image.
        Images are downscaled to 512px before Vision AI for speed.
        """
        pil_img = img_info["pil_image"]
        idx = img_info["index"]
        page_no = img_info["page"]

        # 1. OCR (runs on the full-res image for accuracy)
        ocr_text = ""
        if self.ocr_engine:
            try:
                import numpy as np
                img_array = np.array(pil_img.convert("RGB"))
                result, _ = self.ocr_engine(img_array)
                if result:
                    ocr_text = "\n".join([line[1] for line in result])
            except Exception as e:
                logger.error(f"OCR failed for image {idx}: {e}")

        # 2. Vision AI (runs on larger downscaled image for better detail)
        small_img = self._downscale(pil_img, max_px=768)
        description = self._get_vision_description(small_img)

        # 3. Combine
        combined_text = f"Image from page {page_no}. Description: {description}"
        if ocr_text:
            combined_text += f"\nExtracted Text: {ocr_text}"

        return {
            **img_info,
            "description": description,
            "ocr_text": ocr_text,
            "combined_text": combined_text
        }

    def _get_vision_description(self, pil_img: Image.Image) -> str:
        """
        Calls Ollama Vision model to describe the image.
        Image should already be downscaled before calling this.
        """
        try:
            buffered = io.BytesIO()
            pil_img.save(buffered, format="PNG")
            img_bytes = buffered.getvalue()

            response = ollama.generate(
                model=VISION_MODEL,
                prompt=(
                    "Analyze this technical document image in detail. "
                    "Identify its type (e.g., architecture diagram, flowchart, chart, table). "
                    "Describe the key components, technical labels, and how they relate. "
                    "Explain the core technical information being communicated."
                ),
                images=[img_bytes],
                stream=False,
                options={"num_predict": 512}  # Allow more detailed output
            )
            return response.get("response", "No description generated.")
        except Exception as e:
            logger.error(f"Vision AI failed: {e}")
            return "Error generating AI description."

    def append_images_to_markdown(self, markdown: str, processed_images: List[Dict[str, Any]]) -> str:
        """
        Appends image references and descriptions to the end of the markdown.
        """
        if not processed_images:
            return markdown

        appendix = "\n\n--- \n## Image Intelligence\n"
        for img in processed_images:
            # Relative path for the markdown link
            rel_path = Path(img["path"]).relative_to(self.output_base.parent.parent)
            appendix += f"\n### Image {img['index']} (Page {img['page']})\n"
            appendix += f"![{img['description']}]({rel_path})\n\n"
            appendix += f"**AI Description:** {img['description']}\n"
            if img["ocr_text"]:
                appendix += f"\n**Extracted Text:**\n```\n{img['ocr_text']}\n```\n"

        return markdown + appendix
