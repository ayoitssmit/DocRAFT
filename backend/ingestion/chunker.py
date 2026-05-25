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


def split_into_blocks(markdown: str) -> list[str]:
    lines = markdown.split("\n")
    blocks = []
    
    table_regex = re.compile(r"^\s*\|")
    caption_regex = re.compile(r"(?i)^\s*(figure\s+\d+|fig\.\s*\d+)")
    
    current_text_block = []
    
    i = 0
    while i < len(lines):
        line = lines[i]
        if table_regex.match(line):
            if current_text_block:
                blocks.append("\n".join(current_text_block))
                current_text_block = []
                
            table_lines = []
            while i < len(lines) and table_regex.match(lines[i]):
                table_lines.append(lines[i])
                i += 1
                
            ahead_idx = i
            blank_lines = 0
            found_caption = False
            while ahead_idx < len(lines):
                if not lines[ahead_idx].strip():
                    blank_lines += 1
                    if blank_lines > 2:
                        break
                    ahead_idx += 1
                elif caption_regex.match(lines[ahead_idx]):
                    found_caption = True
                    break
                else:
                    break
                    
            if found_caption:
                while i <= ahead_idx:
                    table_lines.append(lines[i])
                    i += 1
                    
            blocks.append("\n".join(table_lines))
            continue
            
        else:
            current_text_block.append(line)
            i += 1
            
    if current_text_block:
        blocks.append("\n".join(current_text_block))
        
    return blocks


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
        """
        metadata = metadata or {}
        blocks = split_into_blocks(markdown)
        final_nodes = []
        table_regex = re.compile(r"^\s*\|")

        for block in blocks:
            if table_regex.match(block):
                # Table block: store directly
                node = TextNode(text=block, metadata=metadata.copy())
                final_nodes.append(node)
            else:
                # Text block: pass through normal pipeline
                doc = Document(text=block, metadata=metadata.copy())
                initial_nodes = self.parser.get_nodes_from_documents([doc])
                for node in initial_nodes:
                    if len(node.text) > self.sub_chunker.chunk_size:
                        sub_nodes = self.sub_chunker.get_nodes_from_documents([node])
                        for sub_node in sub_nodes:
                            sub_node.metadata.update(node.metadata)
                        final_nodes.extend(sub_nodes)
                    else:
                        final_nodes.append(node)

        # Add chunk index and total chunks to metadata
        total = len(final_nodes)
        for i, node in enumerate(final_nodes):
            node.metadata["chunk_index"] = i
            node.metadata["total_chunks"] = total

        logger.info(
            f"Chunked document into {total} nodes "
            f"(source: {metadata.get('source_file', 'unknown')})"
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
        