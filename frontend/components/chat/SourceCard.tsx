"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, FileText, Image } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ImagePreview } from "./ImagePreview";
import type { QueryResult } from "@/lib/api";

interface SourceCardProps {
  source: QueryResult;
  index: number;
}

export function SourceCard({ source, index }: SourceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [textExpanded, setTextExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expanded && containerRef.current) {
      // Truncate only if natural height is more than 200px (160px limit + 40px threshold)
      const hasOverflow = containerRef.current.scrollHeight > 200;
      setIsOverflowing(hasOverflow);
    } else {
      setIsOverflowing(false);
    }
  }, [expanded, source.text]);

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
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.65,
              color: "var(--c-muted)",
              margin: "12px 0 0",
              fontFamily: "var(--font-display)",
              position: "relative",
            }}
          >
            <div
              ref={containerRef}
              style={{
                maxHeight: (isOverflowing && !textExpanded) ? 160 : "none",
                overflow: "hidden",
                position: "relative",
                transition: "max-height 0.3s ease",
              }}
            >
              <div className="markdown-body">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    img: (props: any) => {
                      const { src, alt } = props;
                      if (!src) return null;
                      return (
                        <div style={{ marginTop: 8, marginBottom: 8 }}>
                          <ImagePreview imagePath={src} alt={typeof alt === "string" ? alt : "Image"} />
                        </div>
                      );
                    }
                  }}
                >
                  {source.text}
                </ReactMarkdown>
              </div>
              {!textExpanded && isOverflowing && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 40,
                    background: "linear-gradient(to bottom, transparent, var(--bg-surface))",
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
            {isOverflowing && (
              <button
                onClick={() => setTextExpanded(!textExpanded)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--c-accent-mid)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  fontFamily: "var(--font-mono)",
                }}
              >
                {textExpanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>

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
