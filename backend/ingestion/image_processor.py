import io
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import base64

import ollama
from PIL import Image
from .config import IMAGE_OUTPUT_DIR, VISION_MODEL

logger = logging.getLogger(__name__)

# Minimum pixel dimensions for an image to be worth analysing.
# Anything smaller is typically a logo, bullet icon, or decorative element.
_MIN_IMAGE_PX = 100

# Substrings that indicate the vision model returned a meta/refusal response
# rather than an actual description of the image content.
_LOW_QUALITY_PHRASES = (
    "too small to discern",
    "too small to identify",
    "too small to determine",
    "please upload",
    "if you have an image",
    "i cannot see",
    "i can't see",
    "no image",
    "image is not visible",
    "no visible content",
    "cannot provide a description",
    "unable to identify",
    "unable to describe",
)

class ImageIntelligence:
    """
    Handles image extraction, OCR, and Vision AI descriptions.
    """

    def __init__(self):
        self.output_base = IMAGE_OUTPUT_DIR
        self.output_base.mkdir(parents=True, exist_ok=True)
        
        # Initialize OCR engine (RapidOCR)
        try:
            # pyrefly: ignore [missing-import]
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
        Images below _MIN_IMAGE_PX in either dimension are skipped — they are
        typically icons or decorative elements that add no retrieval value.
        """
        pil_img = img_info["pil_image"]
        idx = img_info["index"]
        page_no = img_info["page"]
        w, h = pil_img.size

        # Skip tiny images entirely — vision models cannot describe them
        # meaningfully and tend to return meta/refusal responses.
        if w < _MIN_IMAGE_PX or h < _MIN_IMAGE_PX:
            logger.info(
                f"Skipping image {idx} (page {page_no}): too small ({w}x{h}px)."
            )
            return {
                **img_info,
                "description": "",
                "ocr_text": "",
                "combined_text": "",
            }

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

        # 2. Vision AI (runs on a downscaled copy for speed)
        small_img = self._downscale(pil_img, max_px=768)
        description = self._get_vision_description(small_img, ocr_text=ocr_text)

        # 3. Build combined text — sanitize OCR noise before storing.
        sanitized_ocr = ""
        if not str(idx).startswith("tab_") and ocr_text:
            sanitized_lines = []
            for line in ocr_text.split("\n"):
                line = line.strip()
                if len(line) < 3:
                    continue
                if line.isalnum() and " " not in line:
                    continue
                sanitized_lines.append(line)
            sanitized_ocr = "\n".join(sanitized_lines)

        combined_parts = []
        if description:
            combined_parts.append(f"Image from page {page_no}. {description}")
        if sanitized_ocr:
            combined_parts.append(f"Extracted Text: {sanitized_ocr}")
        combined_text = "\n".join(combined_parts)

        return {
            **img_info,
            "description": description,
            "ocr_text": ocr_text,
            "combined_text": combined_text,
        }

    def _get_vision_description(self, pil_img: Image.Image, ocr_text: str = "") -> str:
        """
        Calls the Ollama Vision model to describe the image.
        Returns an empty string when the model produces a meta/refusal response
        (e.g. "image too small") so that nothing leaks into the indexed content.
        """
        try:
            buffered = io.BytesIO()
            pil_img.save(buffered, format="PNG")
            img_bytes = buffered.getvalue()

            context_snippet = (
                f"\n\nText already extracted from this image via OCR:\n{ocr_text}"
                if ocr_text
                else ""
            )

            response = ollama.generate(
                model=VISION_MODEL,
                prompt=(
                    "You are analyzing an image extracted from a technical PDF document. "
                    "Describe only what you can actually see. "
                    "State the image type (e.g. architecture diagram, flowchart, graph, "
                    "table, screenshot) and describe the key components, labels, and "
                    "relationships shown. Be concise and factual. "
                    "Do not ask for clarification or mention this prompt."
                    f"{context_snippet}"
                ),
                images=[img_bytes],
                stream=False,
                options={"num_predict": 512},
            )
            raw = response.get("response", "").strip()

            # Discard responses that are model meta-commentary rather than
            # actual image descriptions.
            if not raw:
                return ""
            lower = raw.lower()
            if any(phrase in lower for phrase in _LOW_QUALITY_PHRASES):
                logger.info("Vision model returned a low-quality response; discarding.")
                return ""

            return raw
        except Exception as e:
            logger.error(f"Vision AI failed: {e}")
            return ""

    def inject_images_into_markdown(self, markdown: str, processed_images: List[Dict[str, Any]]) -> str:
        """
        Replaces <!-- image --> tags with the Vision AI descriptions inline.
        Appends table descriptions at the end (or leaves them as markdown tables).
        """
        import re
        
        if not processed_images:
            return markdown

        # Split images into pictures and tables
        pictures = [img for img in processed_images if str(img["index"]).startswith("pic_")]
        tables = [img for img in processed_images if str(img["index"]).startswith("tab_")]
        
        # Sort pictures by their original index (e.g. pic_0, pic_1)
        pictures.sort(key=lambda x: int(str(x["index"]).split("_")[1]))
        
        # Replace <!-- image --> tags sequentially.
        # If the image has no useful description and no OCR text, the placeholder
        # tag is removed silently rather than injecting an empty or unhelpful block.
        def repl(match):
            if pictures:
                img = pictures.pop(0)
                description = img.get("description", "").strip()
                ocr_text = img.get("ocr_text", "").strip()

                # Nothing useful to inject — remove the tag silently.
                if not description and not ocr_text:
                    return ""

                rel_path = Path(img["path"]).relative_to(self.output_base.parent.parent)
                injection = f"\n\n**Figure (Page {img['page']})**\n"
                injection += f"![Figure page {img['page']}]({rel_path})\n"
                if description:
                    injection += f"\n{description}\n"
                if ocr_text:
                    injection += f"\n<!-- OCR_START -->\n```\n{ocr_text}\n```\n<!-- OCR_END -->\n"
                return injection
            return ""  # No matching picture — remove the orphan tag.

        # Docling outputs <!-- image --> as placeholder tags.
        markdown = re.sub(r'<!-- image -->', repl, markdown)

        # Append table analyses only when there is something meaningful to show.
        useful_tables = [
            t for t in tables
            if t.get("description", "").strip() or t.get("ocr_text", "").strip()
        ]
        if useful_tables:
            markdown += "\n\n---\n## Supplementary Table Analysis\n"
            for img in useful_tables:
                description = img.get("description", "").strip()
                ocr_text = img.get("ocr_text", "").strip()
                rel_path = Path(img["path"]).relative_to(self.output_base.parent.parent)
                markdown += f"\n### Table (Page {img['page']})\n"
                markdown += f"![Table page {img['page']}]({rel_path})\n"
                if description:
                    markdown += f"\n{description}\n"
                if ocr_text:
                    markdown += f"\n<!-- OCR_START -->\n```\n{ocr_text}\n```\n<!-- OCR_END -->\n"

        return markdown
