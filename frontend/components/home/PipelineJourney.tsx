"use client";

import React, { useRef } from "react";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";

const STEPS = [
  {
    title: "Ingestion & Processing",
    description: "Docling orchestrates multimodal PDF ingestion, converting raw enterprise documents into structured Markdown with flawless accuracy.",
  },
  {
    title: "Chunking & Embedding",
    description: "LlamaIndex parses the structured data into semantic chunks, which are then vectorized into 768-dimensional embeddings by nomic-embed-text.",
  },
  {
    title: "Vector Storage",
    description: "High-dimensional embeddings are securely stored and indexed in Qdrant, enabling sub-millisecond similarity search across millions of documents.",
  },
  {
    title: "Agentic Generation",
    description: "LangGraph coordinates a multi-pass retrieval loop, feeding highly relevant context to Qwen 2.5 for incredibly accurate, hallucination-free answers.",
  },
];

function TimelineNode({ step, index }: { step: typeof STEPS[0], index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const entry = useIntersectionObserver(ref, { threshold: 0.5 });
  const isVisible = !!entry?.isIntersecting;

  const isEven = index % 2 === 0;

  return (
    <div 
      ref={ref}
      className={`relative flex items-center justify-between md:justify-normal w-full mb-24 last:mb-0
        ${isEven ? "md:flex-row-reverse" : "md:flex-row"}
      `}
    >
      {/* Spacer for desktop layout */}
      <div className="hidden md:block w-5/12" />

      {/* Content Card */}
      <div 
        className={`w-full ml-12 md:ml-0 md:w-5/12 transition-all duration-1000 ease-out
          ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}
          ${isEven ? "md:text-right md:pr-12" : "md:text-left md:pl-12"}
        `}
      >
        <div className={`p-6 rounded-2xl border border-[#222] bg-[#0a0a0a]/50 backdrop-blur-sm
          hover:border-[var(--c-accent)]/30 hover:bg-[#111] transition-colors duration-300
        `}>
          <div className="flex items-center gap-3 mb-3">
             <span className="text-[var(--c-accent)] font-mono text-sm">0{index + 1}</span>
             <h3 className="text-2xl font-bold tracking-tight text-white">{step.title}</h3>
          </div>
          <p className="text-[#a0a0a0] leading-relaxed text-sm md:text-base">
            {step.description}
          </p>
        </div>
      </div>
    </div>
  );
}

export function PipelineJourney() {
  return (
    <section className="w-full max-w-6xl mx-auto px-6 py-32 relative overflow-hidden font-sans">
      <div className="text-center mb-24">
        <h2 className="text-[clamp(32px,5vw,56px)] font-extrabold tracking-tight mb-4 text-white">
          The <span className="text-[var(--c-accent)]">DocRAFT</span> Journey
        </h2>
        <p className="text-[var(--c-muted)] text-lg max-w-2xl mx-auto">
          A truly enterprise-grade RAG pipeline, designed for absolute precision and speed.
        </p>
      </div>

      <div className="relative w-full max-w-4xl mx-auto">
        {/* Central glowing line */}
        <div className="absolute left-[15px] md:left-1/2 top-0 bottom-0 w-[2px] -translate-x-1/2 bg-gradient-to-b from-transparent via-[var(--c-accent)] to-transparent opacity-30 shadow-[0_0_15px_rgba(201,72,48,0.5)]" />

        {/* Nodes */}
        <div className="relative z-10 py-12">
          {STEPS.map((step, idx) => (
            <TimelineNode key={step.title} step={step} index={idx} />
          ))}
        </div>
      </div>
    </section>
  );
}
