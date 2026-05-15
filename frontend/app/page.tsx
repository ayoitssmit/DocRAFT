"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL } from "@/lib/constants";

interface HealthData {
  status: string;
  environment: string;
  timestamp: string;
  version: string;
}

export default function Home() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setHealth)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "120px 80px 80px",
        position: "relative",
        overflow: "hidden",
        fontFamily: "var(--font-display)",
      }}
    >
      {/* Background grid */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(13,14,12,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(13,14,12,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
        }}
      />

      {/* Eyebrow */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase" as const,
          color: "var(--c-accent)",
          marginBottom: 28,
          opacity: 0,
          animation: "fadeUp 0.6s var(--ease-out) 0.1s forwards",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            background: "var(--c-accent)",
            borderRadius: "50%",
            animation: "pulse 2s ease-in-out infinite",
          }}
        />
        Enterprise RAG Agent
      </div>

      {/* Title */}
      <h1
        style={{
          fontSize: "clamp(64px, 10vw, 112px)",
          fontWeight: 800,
          letterSpacing: "-0.04em",
          lineHeight: 0.92,
          marginBottom: 16,
          opacity: 0,
          animation: "fadeUp 0.7s var(--ease-out) 0.2s forwards",
          position: "relative",
          zIndex: 1,
        }}
      >
        Doc
        <em
          style={{
            fontStyle: "italic",
            fontFamily: "var(--font-serif)",
            fontWeight: 400,
            color: "var(--c-accent)",
          }}
        >
          RAFT
        </em>
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontSize: 18,
          fontWeight: 400,
          color: "var(--c-muted)",
          maxWidth: 560,
          marginBottom: 48,
          lineHeight: 1.7,
          opacity: 0,
          animation: "fadeUp 0.7s var(--ease-out) 0.35s forwards",
          position: "relative",
          zIndex: 1,
        }}
      >
        Enterprise-Grade Retrieval-Augmented Fine-Tuning Agent. Intelligent
        document processing, multimodal knowledge extraction, and semantic search
        at scale.
      </p>

      {/* CTA Buttons */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 48,
          opacity: 0,
          animation: "fadeUp 0.7s var(--ease-out) 0.45s forwards",
          position: "relative",
          zIndex: 1,
        }}
      >
        <Link
          href="/chat"
          className="btn btn-accent"
          style={{ fontSize: 14, padding: "12px 28px" }}
        >
          Start Chatting
        </Link>
        <a
          href="https://github.com/ayoitssmit/DocRAFT"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline"
          style={{ fontSize: 14, padding: "12px 28px" }}
        >
          View on GitHub
        </a>
      </div>

      {/* Meta info */}
      <div
        style={{
          display: "flex",
          gap: 32,
          opacity: 0,
          animation: "fadeUp 0.7s var(--ease-out) 0.5s forwards",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              color: "var(--c-muted)",
            }}
          >
            Powered By
          </span>
          <span
            style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}
          >
            Docling -- LlamaIndex -- Qdrant -- Ollama
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              color: "var(--c-muted)",
            }}
          >
            Status
          </span>
          <span
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            {error ? (
              <span style={{ color: "var(--c-coral)" }}>Backend Offline</span>
            ) : health ? (
              <span style={{ color: "#28C840" }}>
                {health.status} -- v{health.version}
              </span>
            ) : (
              <span style={{ color: "var(--c-amber)" }}>Connecting...</span>
            )}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              color: "var(--c-muted)",
            }}
          >
            Runtime
          </span>
          <span
            style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}
          >
            Local -- FastAPI -- Async
          </span>
        </div>
      </div>

      {/* Stack pills (right side) */}
      <div
        style={{
          position: "absolute",
          right: 80,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          gap: 12,
          opacity: 0,
          animation: "fadeUp 0.8s var(--ease-out) 0.6s forwards",
        }}
      >
        {["Docling", "LlamaIndex", "Qdrant", "Ollama", "FastAPI"].map(
          (tech) => (
            <div
              key={tech}
              style={{
                writingMode: "vertical-rl",
                textOrientation: "mixed",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                padding: "20px 10px",
                borderRadius: 40,
                border: "1px solid var(--c-border-strong)",
                color: "var(--c-muted)",
                background: "var(--bg-surface-raised)",
                whiteSpace: "nowrap",
                transition: "all 0.3s",
                cursor: "default",
              }}
            >
              {tech}
            </div>
          )
        )}
      </div>
    </main>
  );
}
