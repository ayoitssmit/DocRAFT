"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SourceCard } from "@/components/chat/SourceCard";
import { ImagePreview } from "./ImagePreview";
import type { QueryResult } from "@/lib/api";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  sources?: QueryResult[];
}

export function MessageBubble({ role, content, sources }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        padding: "4px 0",
        animation: "fadeUp 0.3s var(--ease-out) forwards",
      }}
    >
      <div
        style={{
          maxWidth: isUser ? "70%" : "85%",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {/* Role label */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            color: "var(--c-muted)",
            fontFamily: "var(--font-mono)",
            paddingLeft: isUser ? 0 : 2,
            paddingRight: isUser ? 2 : 0,
            textAlign: isUser ? "right" : "left",
          }}
        >
          {isUser ? "You" : "DocRAFT"}
        </div>

        {/* Message bubble */}
        <div
          style={{
            padding: "14px 18px",
            borderRadius: isUser
              ? "var(--radius) var(--radius) 4px var(--radius)"
              : "var(--radius) var(--radius) var(--radius) 4px",
            background: isUser
              ? "var(--c-accent)"
              : "var(--bg-surface-raised)",
            color: isUser ? "white" : "var(--text-primary)",
            border: isUser ? "none" : "1px solid var(--c-border)",
            fontSize: 14,
            lineHeight: 1.7,
            fontFamily: "var(--font-display)",
          }}
        >
          {isUser ? (
            <p style={{ margin: 0 }}>{content}</p>
          ) : (
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
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Source Cards (assistant only) */}
        {!isUser && sources && sources.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              paddingLeft: 2,
            }}
          >
            {sources.map((source, idx) => (
              <SourceCard key={source.id || idx} source={source} index={idx} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
