"use client";

import { Upload, X } from "lucide-react";

interface ChatHeaderProps {
  activeFilter: string | null;
  onClearFilter: () => void;
  onUploadClick: () => void;
}

export function ChatHeader({
  activeFilter,
  onClearFilter,
  onUploadClick,
}: ChatHeaderProps) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 24px",
        borderBottom: "1px solid var(--c-border)",
        background: "var(--bg-surface-raised)",
        flexShrink: 0,
      }}
    >
      {/* Left: Title + Filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <h1
          style={{
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
            fontFamily: "var(--font-display)",
          }}
        >
          Chat
        </h1>

        {activeFilter && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 20,
              background: "rgba(30,122,140,0.15)",
              color: "var(--c-teal)",
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.02em",
            }}
          >
            {activeFilter}
            <button
              onClick={onClearFilter}
              style={{
                background: "transparent",
                border: "none",
                color: "inherit",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
              }}
              aria-label="Clear filter"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Right: Upload button */}
      <button
        onClick={onUploadClick}
        className="btn btn-accent"
        style={{ fontSize: 12, padding: "7px 14px" }}
      >
        <Upload size={14} />
        Upload PDF
      </button>
    </header>
  );
}
