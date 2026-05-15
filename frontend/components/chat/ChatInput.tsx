"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";

interface ChatInputProps {
  input: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}

export function ChatInput({
  input,
  onChange,
  onSubmit,
  isLoading,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if ((input || "").trim() && !isLoading) {
        onSubmit(e as unknown as React.FormEvent);
      }
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 12,
        padding: "16px 24px",
        borderTop: "1px solid var(--c-border)",
        background: "var(--bg-surface-raised)",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "flex-end",
          gap: 12,
          background: "var(--bg-primary)",
          border: "1px solid var(--c-border-strong)",
          borderRadius: "var(--radius)",
          padding: "10px 14px",
          transition: "border-color var(--dur-fast)",
        }}
      >
        <textarea
          ref={textareaRef}
          value={input || ""}
          onChange={onChange || (() => {})}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your documents..."
          rows={1}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--text-primary)",
            fontFamily: "var(--font-display)",
            fontSize: 14,
            lineHeight: 1.5,
            resize: "none",
            minHeight: "24px",
            maxHeight: "160px",
          }}
        />
      </div>
      <button
        type="submit"
        disabled={!(input || "").trim() || isLoading}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          borderRadius: "var(--radius-sm)",
          border: "none",
          background:
            (input || "").trim() && !isLoading
              ? "var(--c-accent)"
              : "var(--c-border-strong)",
          color: (input || "").trim() && !isLoading ? "white" : "var(--c-muted)",
          cursor: (input || "").trim() && !isLoading ? "pointer" : "not-allowed",
          transition: "all var(--dur-fast) var(--ease-spring)",
          flexShrink: 0,
        }}
      >
        {isLoading ? (
          <div
            style={{
              width: 16,
              height: 16,
              border: "2px solid rgba(255,255,255,0.3)",
              borderTopColor: "white",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
        ) : (
          <Send size={16} />
        )}
      </button>
    </form>
  );
}
