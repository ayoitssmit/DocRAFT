"use client";

import { useRef, useEffect } from "react";
import { MessageBubble } from "./MessageBubble";
export interface Message {
  id: string;
  role: string;
  content: string;
}
import type { QueryResult } from "@/lib/api";

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
  sourcesMap: Record<string, QueryResult[]>;
}

export function ChatWindow({
  messages,
  isLoading,
  sourcesMap,
}: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef(true);
  const lastMessageCountRef = useRef(messages.length);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (container) {
      // 100px threshold for being "at the bottom"
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      isAutoScrollRef.current = isNearBottom;
    }
  };

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const isNewMessage = messages.length > lastMessageCountRef.current;
    lastMessageCountRef.current = messages.length;

    if (isAutoScrollRef.current || isNewMessage) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      isAutoScrollRef.current = true;
    }
  }, [messages, isLoading]);

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {messages.length === 0 && !isLoading && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            textAlign: "center",
            padding: "64px 24px",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              background: "var(--c-accent)",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 800,
              color: "white",
              letterSpacing: "-0.05em",
              fontFamily: "var(--font-display)",
            }}
          >
            DR
          </div>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "var(--text-primary)",
              fontFamily: "var(--font-display)",
            }}
          >
            Doc<em style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400, color: "var(--c-accent)" }}>RAFT</em>
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "var(--c-muted)",
              maxWidth: 400,
              lineHeight: 1.7,
            }}
          >
            Ask questions about your uploaded documents. DocRAFT will search
            through your knowledge base and provide grounded answers with source
            citations.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              justifyContent: "center",
              marginTop: 8,
            }}
          >
            {[
              "What does the paper say about attention mechanisms?",
              "Summarize the key findings",
              "Show me the architecture diagram",
            ].map((suggestion) => (
              <div
                key={suggestion}
                style={{
                  fontSize: 12,
                  padding: "8px 14px",
                  borderRadius: 20,
                  border: "1px solid var(--c-border-strong)",
                  color: "var(--c-muted)",
                  fontFamily: "var(--font-display)",
                  cursor: "default",
                }}
              >
                {suggestion}
              </div>
            ))}
          </div>
        </div>
      )}

      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          role={message.role as "user" | "assistant"}
          content={(message as any).content}
          sources={
            message.role === "assistant" ? sourcesMap[message.id] : undefined
          }
        />
      ))}

      {/* Typing indicator */}
      {isLoading &&
        messages.length > 0 &&
        messages[messages.length - 1].role === "user" && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-start",
              padding: "4px 0",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase" as const,
                  color: "var(--c-muted)",
                  fontFamily: "var(--font-mono)",
                  paddingLeft: 2,
                }}
              >
                DocRAFT
              </div>
              <div
                style={{
                  padding: "14px 18px",
                  borderRadius: "var(--radius) var(--radius) var(--radius) 4px",
                  background: "var(--bg-surface-raised)",
                  border: "1px solid var(--c-border)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background:
                          i === 0
                            ? "var(--c-steel)"
                            : i === 1
                              ? "var(--c-accent)"
                              : "var(--c-teal)",
                        animation: `bounce 0.8s ease-in-out infinite ${i * 0.15}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      <div ref={bottomRef} />
    </div>
  );
}
