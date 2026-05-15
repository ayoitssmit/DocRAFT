"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, FileText, Image } from "lucide-react";
import { ImagePreview } from "./ImagePreview";
import type { QueryResult } from "@/lib/api";

interface SourceCardProps {
  source: QueryResult;
  index: number;
}

export function SourceCard({ source, index }: SourceCardProps) {
  const [expanded, setExpanded] = useState(false);

  const docName =
    source.source_document || source.filename || "unknown";
  const score = source.score?.toFixed(3) || "N/A";
  const contentType = source.content_type || "text";
  const isImage = contentType === "image";

  return (
    <div
      style={{
        borderRadius: "var(--radius)",
        border: "1px solid var(--c-border)",
        background: "var(--bg-surface)",
        overflow: "hidden",
        transition: "all var(--dur-fast) var(--ease-spring)",
      }}
    >
      {/* Header row -- always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--c-muted)",
          textAlign: "left",
        }}
      >
        {isImage ? (
          <Image size={14} style={{ color: "var(--c-teal)", flexShrink: 0 }} />
        ) : (
          <FileText
            size={14}
            style={{ color: "var(--c-accent-mid)", flexShrink: 0 }}
          />
        )}
        <span
          style={{
            color: "var(--c-accent-mid)",
            fontWeight: 500,
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {docName}
        </span>
        <span style={{ color: "var(--c-muted)", fontWeight: 600 }}>
          {score}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 6px",
            borderRadius: 4,
            background: "rgba(255,255,255,0.06)",
            color: "var(--c-muted)",
            letterSpacing: "0.08em",
          }}
        >
          {contentType}
        </span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div
          style={{
            padding: "0 14px 14px",
            borderTop: "1px solid var(--c-border)",
            animation: "fadeIn 0.2s var(--ease-out)",
          }}
        >
          {/* Image preview if applicable */}
          {isImage && source.image_path && (
            <div style={{ marginTop: 12, marginBottom: 8 }}>
              <ImagePreview imagePath={source.image_path} alt={docName} />
            </div>
          )}

          {/* Text content */}
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.65,
              color: "var(--c-muted)",
              margin: "12px 0 0",
              fontFamily: "var(--font-display)",
              whiteSpace: "pre-wrap",
            }}
          >
            {source.text}
          </p>

          {/* Source tag */}
          <div style={{ marginTop: 10 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 4,
                background: "rgba(201,72,48,0.12)",
                color: "var(--c-accent-mid)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.06em",
              }}
            >
              Source {index + 1}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
