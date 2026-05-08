"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6">
      {/* ── Background glow orbs ──────────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[520px] w-[520px] rounded-full bg-gradient-to-br from-indigo-500/30 via-purple-500/20 to-cyan-400/10 blur-3xl animate-float"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-gradient-to-tl from-emerald-500/20 via-teal-500/10 to-transparent blur-2xl animate-pulse-glow"
      />

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section id="hero" className="relative z-10 flex flex-col items-center gap-6 text-center max-w-2xl">
        {/* Logo mark */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="h-7 w-7 text-white"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Doc<span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">RAFT</span>
          </h1>
        </div>

        <p className="text-lg text-foreground/60 leading-relaxed max-w-xl">
          Enterprise-Grade{" "}
          <span className="font-semibold text-foreground/80">
            Retrieval-Augmented Fine-Tuning
          </span>{" "}
          Agent — powering intelligent document processing and knowledge
          extraction at scale.
        </p>

        {/* ── Status card ─────────────────────────────────────────── */}
        <div
          id="status-card"
          className="mt-4 w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl"
        >
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-foreground/40">
            System Status
          </h2>

          {error ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
              </span>
              <span className="text-red-400">
                Backend unreachable&ensp;—&ensp;
                <code className="text-xs opacity-70">{error}</code>
              </span>
            </div>
          ) : health ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                </span>
                <span className="font-medium text-emerald-400 capitalize">
                  {health.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-y-2 text-foreground/50">
                <span>Environment</span>
                <span className="text-right font-mono text-foreground/70">
                  {health.environment}
                </span>
                <span>Version</span>
                <span className="text-right font-mono text-foreground/70">
                  v{health.version}
                </span>
                <span>Timestamp</span>
                <span className="text-right font-mono text-foreground/70 text-xs">
                  {new Date(health.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm text-foreground/40">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
              </span>
              Connecting to backend…
            </div>
          )}
        </div>

        {/* ── Stack badges ────────────────────────────────────────── */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-foreground/40">
          {["Next.js", "FastAPI", "Qdrant", "Ollama", "Docker"].map((t) => (
            <span
              key={t}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1"
            >
              {t}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
