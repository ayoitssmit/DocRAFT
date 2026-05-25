"""
LlamaIndex Markdown chunker.
Splits Markdown documents into heading-aware chunks using MarkdownNodeParser.
"""

import logging
import re
from typing import Any

from llama_index.core import Document
from llama_index.core.node_parser import MarkdownNodeParser, SentenceSplitter
from llama_index.core.schema import TextNode

from .config import CHUNK_SIZE, CHUNK_OVERLAP

logger = logging.getLogger(__name__)


class MarkdownChunker:
    """Chunks Markdown text into heading-aware nodes using LlamaIndex."""

    def __init__(self, chunk_size: int = CHUNK_SIZE, chunk_overlap: int = CHUNK_OVERLAP):
        """Initialize the MarkdownNodeParser and sub-chunker."""
        self.parser = MarkdownNodeParser()
        self.sub_chunker = SentenceSplitter(
            chunk_size=chunk_size, 
            chunk_overlap=chunk_overlap
        )

    def chunk(
        self, markdown: str, metadata: dict[str, Any] | None = None
    ) -> list[TextNode]:
        """
        Split a Markdown string into heading-aware chunks.

        Each chunk inherits metadata from the source document and gets
        additional heading context from the parser.

        Args:
            markdown: Raw Markdown text to chunk.
            metadata: Optional metadata dict to attach to every chunk
                      (e.g., source_file, converted_at).

        Returns:
            List of LlamaIndex TextNode objects with text and metadata.
        """
        doc = Document(text=markdown, metadata=metadata or {})
        initial_nodes = self.parser.get_nodes_from_documents([doc])
        
        # Second pass: ensure no chunk exceeds the size limit
        final_nodes = []
        table_regex = re.compile(r"^\s*\||^\s*[-|]+$", re.MULTILINE)
        for node in initial_nodes:
            # Strictly split if character count exceeds CHUNK_SIZE
            # (Roughly 1 char = 1-4 tokens, 1024 chars is safe for almost any model)
            if table_regex.search(node.text):
                final_nodes.append(node)
            elif len(node.text) > self.sub_chunker.chunk_size:
                sub_nodes = self.sub_chunker.get_nodes_from_documents([node])
                # Transfer metadata from parent node
                for sub_node in sub_nodes:
                    sub_node.metadata.update(node.metadata)
                final_nodes.extend(sub_nodes)
            else:
                final_nodes.append(node)

        logger.info(
            f"Chunked document into {len(final_nodes)} nodes (structural: {len(initial_nodes)}) "
            f"(source: {metadata.get('source_file', 'unknown') if metadata else 'unknown'})"
        )

        return final_nodes

    def chunk_batch(
        self, documents: list[dict]
    ) -> list[dict]:
        """
        Chunk multiple converted documents.

        Args:
            documents: List of dicts from DoclingConverter, each with
                       keys: filename, markdown, converted_at.

        Returns:
            List of dicts, each with keys: filename, nodes, node_count.
        """
        results = []
        for doc in documents:
            metadata = {
                "source_file": doc["filename"],
                "converted_at": doc["converted_at"],
            }
            nodes = self.chunk(doc["markdown"], metadata=metadata)
            results.append({
                "filename": doc["filename"],
                "nodes": nodes,
                "node_count": len(nodes),
            })

        total_nodes = sum(r["node_count"] for r in results)
        logger.info(
            f"Batch chunking complete: {len(documents)} docs -> {total_nodes} total nodes"
        )
        return results
        