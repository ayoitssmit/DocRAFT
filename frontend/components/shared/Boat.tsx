"use client";

import React from "react";

export function Boat() {
  return (
    <div className="relative flex flex-col items-center justify-center opacity-0 animate-[fadeIn_0.5s_var(--ease-out)_1.5s_forwards] pointer-events-none ml-6">
      <svg
        viewBox="0 0 400 300"
        width="140"
        height="105"
        style={{
          filter: "drop-shadow(0 0 10px rgba(201, 72, 48, 0.8))",
        }}
      >
        {/* The Boat that bobs up and down */}
        <g style={{ animation: "boatBob 4s ease-in-out infinite" }}>
          
          {/* Main Hull */}
          <path
            d="M 40 40 Q 60 180 120 230 Q 220 250 330 230 L 380 230 L 350 200 C 370 140 380 90 370 50 L 350 50 C 350 80 340 130 310 170 L 90 160 Q 70 100 55 40 Z"
            fill="none"
            stroke="var(--c-accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 1000,
              strokeDashoffset: 1000,
              animation: "boatDraw 2s ease-out 1.5s forwards",
            }}
          />

          {/* Eye on the Bow */}
          <path
            d="M 310 180 Q 325 170 340 180 Q 325 190 310 180 Z"
            fill="none"
            stroke="var(--c-accent)"
            strokeWidth="2"
            style={{
              strokeDasharray: 100,
              strokeDashoffset: 100,
              animation: "boatDraw 1.5s ease-out 2s forwards",
            }}
          />
          <circle 
            cx="325" 
            cy="180" 
            r="3" 
            fill="transparent"
            stroke="var(--c-accent)"
            strokeWidth="2"
            style={{
              strokeDasharray: 20,
              strokeDashoffset: 20,
              animation: "boatDraw 1s ease-out 2.5s forwards",
            }}
          />

          {/* Sail & Mast */}
          <line
            x1="180" y1="160" x2="180" y2="40"
            stroke="var(--c-accent)" strokeWidth="3" strokeLinecap="round"
            style={{
              strokeDasharray: 200, strokeDashoffset: 200,
              animation: "boatDraw 1.5s ease-out 1.8s forwards"
            }}
          />
          <path
            d="M 110 60 Q 180 40 250 60 Q 270 100 240 150 Q 180 170 100 140 Q 130 100 110 60 Z"
            fill="none"
            stroke="var(--c-accent)"
            strokeWidth="3"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 600, strokeDashoffset: 600,
              animation: "boatDraw 2s ease-out 2s forwards"
            }}
          />

          {/* Oars */}
          {[110, 140, 170, 200, 230, 260].map((x, i) => (
            <line
              key={i}
              x1={x} y1="185" x2={x - 40} y2="250"
              stroke="var(--c-accent)" strokeWidth="3" strokeLinecap="round"
              style={{
                strokeDasharray: 100, strokeDashoffset: 100,
                animation: `boatDraw 1s ease-out ${2.2 + i * 0.1}s forwards`
              }}
            />
          ))}
        </g>

        {/* Waves flowing infinitely */}
        <g>
          {/* We create a long path and translate it horizontally for a continuous flow */}
          <path
            d="M -100 230 Q -50 200 0 230 T 100 230 T 200 230 T 300 230 T 400 230 T 500 230 T 600 230"
            fill="none"
            stroke="var(--c-accent)"
            strokeWidth="2"
            strokeLinecap="round"
            style={{
              strokeDasharray: 1500, strokeDashoffset: 1500,
              animation: "boatDraw 2s ease-out 2.5s forwards, waveFlow 3s linear infinite"
            }}
          />
          <path
            d="M -50 250 Q 0 220 50 250 T 150 250 T 250 250 T 350 250 T 450 250 T 550 250 T 650 250"
            fill="none"
            stroke="var(--c-accent)"
            strokeWidth="2"
            strokeLinecap="round"
            style={{
              strokeDasharray: 1500, strokeDashoffset: 1500,
              animation: "boatDraw 2s ease-out 2.7s forwards, waveFlow 4s linear infinite"
            }}
          />
        </g>
      </svg>
    </div>
  );
}
