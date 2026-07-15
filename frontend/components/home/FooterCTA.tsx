"use client";

import React from "react";
import Link from "next/link";
import { Mail, ArrowRight } from "lucide-react";

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

const TEAM = [
  {
    name: "Jalpan Vyas",
    email: "jalpan2104@gmail.com",
    github: "jalpan04",
  },
  {
    name: "Smit Shah",
    email: "smitshah3005@gmail.com",
    github: "ayoitssmit",
  },
];

export function FooterCTA() {
  return (
    <footer className="w-full border-t border-[#1a1a1a] bg-[#050505] relative overflow-hidden font-sans">
      
      {/* Call to Action Section */}
      <div className="w-full max-w-4xl mx-auto px-6 py-32 flex flex-col items-center text-center relative z-10">
        <h2 className="text-[clamp(32px,5vw,56px)] font-extrabold tracking-tight mb-8 text-white">
          Ready to navigate your data?
        </h2>
        
        <Link 
          href="/chat" 
          className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white bg-[var(--c-accent)] rounded-full overflow-hidden transition-transform hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(201,72,48,0.4)] hover:shadow-[0_0_40px_rgba(201,72,48,0.6)]"
        >
          <span className="relative z-10 flex items-center gap-2">
            Start Rafting <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </span>
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
        </Link>
      </div>

      {/* Contact & Team Footer */}
      <div className="w-full border-t border-[#1a1a1a] bg-black">
        <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-8">
          
          <div className="flex flex-col items-center md:items-start">
            <span className="text-2xl font-extrabold tracking-tight text-white mb-2">
              Doc<em className="font-serif italic font-normal text-[var(--c-accent)]">RAFT</em>
            </span>
            <span className="text-sm text-[#666]">© {new Date().getFullYear()} DocRAFT. All rights reserved.</span>
          </div>

          <div className="flex flex-col md:flex-row gap-8 md:gap-16">
            {TEAM.map((member) => (
              <div key={member.name} className="flex flex-col items-center md:items-start gap-3">
                <span className="text-white font-semibold">{member.name}</span>
                <div className="flex flex-col gap-2">
                  <a 
                    href={`mailto:${member.email}`}
                    className="flex items-center gap-2 text-[#888] hover:text-[var(--c-accent)] transition-colors text-sm"
                  >
                    <Mail className="w-4 h-4" />
                    {member.email}
                  </a>
                  <a 
                    href={`https://github.com/${member.github}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[#888] hover:text-white transition-colors text-sm"
                  >
                    <GithubIcon className="w-4 h-4" />
                    github.com/{member.github}
                  </a>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </footer>
  );
}
