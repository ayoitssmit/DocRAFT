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

import { Boat } from "@/components/shared/Boat";
import { PipelineJourney } from "@/components/home/PipelineJourney";
import { UlyssesBrain } from "@/components/home/UlyssesBrain";
import { FooterCTA } from "@/components/home/FooterCTA";
import { ChevronDown } from "lucide-react";

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
    <div className="w-full bg-[var(--c-background)]">
      <main className="min-h-screen flex flex-col items-center justify-center p-8 md:p-24 relative overflow-hidden font-sans">
        {/* Background grid */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage:
              "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
          }}
        />

        {/* Main Content Container */}
        <div className="flex flex-col items-center text-center z-10 w-full max-w-4xl">
          

          {/* Title with handwriting (clip-path reveal) effect */}
          <div className="relative flex flex-col items-center">
            <h1 className="text-[clamp(64px,10vw,112px)] font-extrabold tracking-tight leading-[0.92] relative flex items-center">
               <span 
                 className="relative inline-block whitespace-nowrap animate-reveal-right text-[var(--c-accent)] pr-8 -mr-8"
                 style={{ animationDelay: "0.2s" }}
               >
                 Doc<em className="font-serif italic font-normal text-[var(--c-accent)]">RAFT</em>
               </span>
               <Boat />
            </h1>

            {/* Subtitle */}
            <p className="absolute top-full left-1/2 -translate-x-1/2 mt-6 text-lg font-normal text-[var(--c-muted)] max-w-2xl text-center w-[200%] leading-relaxed opacity-0 animate-[fadeUp_0.7s_var(--ease-out)_0.8s_forwards]">
              Skip the odyssey. Find the truth.
            </p>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce opacity-0 animate-[fadeIn_1s_var(--ease-out)_2.5s_forwards] text-[var(--c-accent)]">
          <ChevronDown size={32} strokeWidth={1.5} />
        </div>
      </main>

      {/* The Journey Section */}
      <PipelineJourney />

      {/* Ulysses Brain Section */}
      <UlyssesBrain />

      {/* Footer & CTA */}
      <FooterCTA />
    </div>
  );
}
