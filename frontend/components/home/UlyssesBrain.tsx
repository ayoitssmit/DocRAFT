"use client";

import React, { useRef } from "react";
import { BrainCircuit, Zap, Target } from "lucide-react";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";

const PILLARS = [
  {
    title: "Domain-Tuned Intelligence",
    description: "Fine-tuned specifically for deep document understanding, extracting nuanced knowledge that general-purpose models miss.",
    icon: Target,
  },
  {
    title: "Agentic Reasoning",
    description: "The autonomous driver making real-time re-querying and synthesis decisions within our LangGraph multi-pass loops.",
    icon: BrainCircuit,
  },
  {
    title: "Uncompromising Speed",
    description: "Optimized for extreme low-latency inference on enterprise hardware, ensuring instant retrieval when you need it most.",
    icon: Zap,
  }
];

export function UlyssesBrain() {
  const containerRef = useRef<HTMLElement>(null);
  const entry = useIntersectionObserver(containerRef, { threshold: 0.2 });
  const isVisible = !!entry?.isIntersecting;

  return (
    <section ref={containerRef} className="w-full max-w-7xl mx-auto px-6 py-32 relative overflow-hidden font-sans border-t border-[#1a1a1a]">
      {/* Background Glow */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[var(--c-accent)]/5 rounded-full blur-[120px] pointer-events-none transition-opacity duration-1000"
        style={{ opacity: isVisible ? 1 : 0 }}
      />

      <div className="relative z-10 flex flex-col items-center">
        
        {/* Pulsing Core */}
        <div className={`relative flex items-center justify-center mb-12 transition-all duration-1000 transform ${isVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}>
          {/* Outer ring */}
          <div className="absolute w-40 h-40 rounded-full border border-[var(--c-accent)]/20 animate-[spin_10s_linear_infinite]" />
          <div className="absolute w-40 h-40 rounded-full border border-[var(--c-accent)]/30 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" />
          
          {/* Inner core */}
          <div className="relative w-24 h-24 rounded-full bg-[#111] border border-[var(--c-accent)] flex items-center justify-center shadow-[0_0_40px_rgba(201,72,48,0.4)]">
            <BrainCircuit className="w-10 h-10 text-[var(--c-accent)] animate-pulse" />
          </div>
        </div>

        {/* Title */}
        <div className={`text-center mb-24 transition-all duration-1000 delay-200 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <h2 className="text-[clamp(40px,6vw,72px)] font-extrabold tracking-tight mb-4 text-white uppercase">
            Meet <span className="text-[var(--c-accent)]">Ulysses</span>
          </h2>
          <p className="text-[var(--c-muted)] text-xl max-w-2xl mx-auto">
            Our fine-tuned, in-house intelligence model. The autonomous brain driving every decision, query, and synthesis.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
          {PILLARS.map((pillar, idx) => (
            <div 
              key={pillar.title}
              className={`flex flex-col p-8 rounded-2xl border border-[#222] bg-[#0a0a0a]/80 backdrop-blur-sm
                hover:border-[var(--c-accent)]/50 hover:shadow-[0_0_30px_rgba(201,72,48,0.15)] transition-all duration-500 group
              `}
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(40px)',
                transitionDelay: `${400 + idx * 150}ms`,
                transitionDuration: '700ms'
              }}
            >
              <div className="w-14 h-14 rounded-xl bg-[#111] border border-[#333] flex items-center justify-center mb-6 group-hover:border-[var(--c-accent)] transition-colors duration-500">
                <pillar.icon className="w-7 h-7 text-[#888] group-hover:text-[var(--c-accent)] transition-colors duration-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3 tracking-tight">{pillar.title}</h3>
              <p className="text-[#a0a0a0] leading-relaxed">
                {pillar.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
