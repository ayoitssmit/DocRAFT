"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { SourceCard } from "@/components/chat/SourceCard";
import { ImagePreview } from "./ImagePreview";
import type { QueryResult } from "@/lib/api";

function balanceMathInBlock(block: string): string {
  // 1. Balance double dollars $$
  const displayParts = block.split("$$");
  if (displayParts.length % 2 === 0) {
    block = block + "$$";
  }

  // 2. Balance single dollars $
  const withoutDouble = block.replace(/\$\$/g, "");
  const inlineParts = withoutDouble.split("$");
  if (inlineParts.length % 2 === 0) {
    block = block + "$";
  }

  return block;
}

function preprocessLaTeX(text: string): string {
  if (!text) return "";

  // Split text by block-level elements (double newlines or headers starting on a new line)
  const blocks = text.split(/\n\n|\n(?=# )|\n(?=## )|\n(?=### )/g);
  
  const balancedBlocks = blocks.map(block => {
    let processed = block;
    
    // Normalize circumflex modifier "ˆ" to standard LaTeX "\hat"
    processed = processed.replace(/ˆ{([^}]+)}/g, '\\hat{$1}');
    processed = processed.replace(/ˆ([a-zA-Z0-9])/g, '\\hat{$1}');

    // Targeted plain text math normalizations (e.g. from raw document text)
    processed = processed.replace(/ˆ\s*c\s*attr/g, '$\\hat{c}_{attr}$');
    processed = processed.replace(/\bc\s+attr/g, '$c_{attr}$');
    processed = processed.replace(/ˆ\s*x\s*t/g, '$\\hat{x}_t$');
    processed = processed.replace(/ˆ\s*x\s*T/g, '$\\hat{x}_T$');
    processed = processed.replace(/\bx\s+T\b/g, '$x_T$');
    processed = processed.replace(/\bz\s+t\b/g, '$z_t$');
    processed = processed.replace(/\bx\s+t\b/g, '$x_t$');
    processed = processed.replace(/λ\s*cfg/g, '$\\lambda_{cfg}$');
    processed = processed.replace(/λ\s*{cfg}/g, '$\\lambda_{cfg}$');

    return balanceMathInBlock(processed);
  });

  let processed = balancedBlocks.join("\n\n");

  // 1. First, replace standard block math delimiters: \[ ... \] -> $$...$$
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_, equation) => {
    return `$$\n${equation.trim()}\n$$`;
  });

  // 2. Replace standard inline math delimiters: \( ... \) -> $...$
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_, equation) => {
    return `$${equation.trim()}$`;
  });

  // 3. Replace [ ... ] that is clearly block math:
  processed = processed.replace(/(?:^|\s)\[\s*([^\]\n]+?)\s*\](?:\s|$)/g, (match, content) => {
    const hasMathSymbols = /\\|[\+\-\*=<>_^{}\\]|\\nabla|\\left|\\right|λ|lambda/i.test(content);
    const isRegularText = /^[a-zA-Z\s,.'"]+$/.test(content);
    if (hasMathSymbols && !isRegularText) {
      const normalized = content.replace(/λ/g, '\\lambda');
      return `\n$$\n${normalized.trim()}\n$$\n`;
    }
    return match;
  });

  // 4. Replace ( ... ) that is clearly inline math:
  processed = processed.replace(/(?:^|\s)\(\s*([^\)\n]+?)\s*\)(?:\s|$)/g, (match, content) => {
    const trimmed = content.trim();
    
    const hasBackslash = trimmed.includes('\\');
    const hasMathOperators = /^[a-zA-Z0-9\s_+=\-^*/<>ˆ{}]*$/.test(trimmed) && /[_^ˆ{}=]/.test(trimmed);
    const isSingleVariable = /^[a-zA-Z]$/.test(trimmed);
    const hasGreekLetter = /[λθπσΩΔΦαβγδε]/.test(trimmed);
    
    const isCommonEnglishPhrase = /^(e\.g\.|i\.e\.|etc\.|and|or|a|an|the|to|in|of|for|on|with|at|by|from)\b/i.test(trimmed);
    const hasManyWords = trimmed.split(/\s+/).length > 5;
    
    if ((hasBackslash || hasMathOperators || isSingleVariable || hasGreekLetter) && !isCommonEnglishPhrase && !hasManyWords) {
      const normalized = trimmed.replace(/λ/g, '\\lambda');
      return ` $${normalized}$ `;
    }
    
    return match;
  });

  return processed;
}

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  sources?: QueryResult[];
}

export function MessageBubble({ role, content, sources }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        padding: "4px 0",
        animation: "fadeUp 0.3s var(--ease-out) forwards",
      }}
    >
      <div
        style={{
          maxWidth: isUser ? "70%" : "85%",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {/* Role label */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            color: "var(--c-muted)",
            fontFamily: "var(--font-mono)",
            paddingLeft: isUser ? 0 : 2,
            paddingRight: isUser ? 2 : 0,
            textAlign: isUser ? "right" : "left",
          }}
        >
          {isUser ? "You" : "DocRAFT"}
        </div>

        {/* Message bubble */}
        <div
          style={{
            padding: "14px 18px",
            borderRadius: isUser
              ? "var(--radius) var(--radius) 4px var(--radius)"
              : "var(--radius) var(--radius) var(--radius) 4px",
            background: isUser
              ? "var(--c-accent)"
              : "var(--bg-surface-raised)",
            color: isUser ? "white" : "var(--text-primary)",
            border: isUser ? "none" : "1px solid var(--c-border)",
            fontSize: 14,
            lineHeight: 1.7,
            fontFamily: "var(--font-display)",
          }}
        >
          <div className="markdown-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{
                p: (props: any) => <div className="markdown-p" style={{ margin: 0, marginBottom: "0.5em", color: isUser ? "white" : "inherit" }} {...props} />,
                img: (props: any) => {
                  const { src, alt } = props;
                  if (!src) return null;
                  return (
                    <span style={{ display: "block", marginTop: 8, marginBottom: 8 }}>
                      <ImagePreview imagePath={src} alt={typeof alt === "string" ? alt : "Image"} />
                    </span>
                  );
                }
              }}
            >
              {preprocessLaTeX(content)}
            </ReactMarkdown>
          </div>
        </div>

        {/* Source Cards (assistant only) */}
        {!isUser && sources && sources.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              paddingLeft: 2,
            }}
          >
            {sources.map((source, idx) => (
              <SourceCard key={source.id || idx} source={source} index={idx} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
