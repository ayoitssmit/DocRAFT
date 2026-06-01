"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, FileText, Image } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";
import { ImagePreview } from "./ImagePreview";
import type { QueryResult } from "@/lib/api";

function preprocessLaTeX(text: string): string {
  if (!text) return "";

  // Normalize circumflex modifier "ˆ" to standard LaTeX "\hat"
  let processed = text.replace(/ˆ{([^}]+)}/g, '\\hat{$1}');
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

  // 1. First, replace standard block math delimiters: \[ ... \] -> $$...$$
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_, equation) => {
    return `$$\n${equation.trim()}\n$$`;
  });

  // 2. Replace standard inline math delimiters: \( ... \) -> $...$
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_, equation) => {
    return `$${equation.trim()}$`;
  });

  // 3. Replace [ ... ] that is clearly block math:
  // E.g., [ ˆ{x}t = x_t + λ{cfg} \nabla_x E\left( ˆ{c}{attr}, x_t, t \right) ]
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
  // E.g. ( \nabla_x E\left( ˆ{c}_{attr}, x_t, t \right) ), ( x_T ), ( z_t ), ( t ), ( λ_{cfg} )
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

function preprocessText(text: string) {
  if (!text) return "";
  
  // 1. Strip OCR blocks enclosed in custom <!-- OCR_START --> ... <!-- OCR_END --> comments
  let processed = text.replace(/<!--\s*OCR_START\s*-->[\s\S]*?<!--\s*OCR_END\s*-->/gi, '').trim();
  
  // 2. Omit "Extracted Text:" (internal OCR) from the displayed sources
  processed = processed.replace(/Extracted Text:[\s\S]*?$/i, '').trim();
  
  // 3. Fallback: Remove raw OCR code blocks for legacy indexed documents (lists of numbers, confusion matrices, or short single-value lines)
  processed = processed.replace(/```[\s\S]*?```/g, (match) => {
    const content = match.slice(3, -3).trim();
    const commaCount = (content.match(/,/g) || []).length;
    const digitCount = (content.match(/\d/g) || []).length;
    const letterCount = (content.match(/[a-zA-Z]/g) || []).length;
    
    // If it has lots of commas or digits compared to letters, or has lines with single letters/numbers (confusion matrix style), it is OCR!
    if (commaCount > 10 || (digitCount > 20 && letterCount < 20) || content.split('\n').every(line => line.trim().length < 8)) {
      return ""; // Strip it completely!
    }
    return match;
  });
  
  // If the entire text was OCR and is now empty, return empty
  if (!processed.trim()) return "";
  
  // (a) normalize multi-space-padded pipe table cells by collapsing internal whitespace
  // (b) ensure every pipe table has a valid separator row
  const lines = processed.split('\n');
  const resultLines = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('|')) {
      let normLine = line.split('|').map(cell => {
        if (cell.trim() === '') return cell;
        return ' ' + cell.trim().replace(/\s+/g, ' ') + ' ';
      }).join('|');
      
      normLine = normLine.trim();
      if (normLine.startsWith(' |')) normLine = '|' + normLine.slice(2);
      if (normLine.endsWith('| ')) normLine = normLine.slice(0, -2) + '|';
      
      resultLines.push(normLine);
      
      if (!inTable) {
        inTable = true;
        const nextLine = lines[i+1] || "";
        const isSeparator = nextLine.trim().startsWith('|') && /^[\s|:*-]+$/.test(nextLine.trim());
        if (!isSeparator) {
          const cols = normLine.split('|').length - 2; 
          const sepCols = Math.max(1, cols);
          resultLines.push('|' + '---|'.repeat(sepCols));
        }
      }
    } else {
      inTable = false;
      resultLines.push(line);
    }
  }
  return preprocessLaTeX(resultLines.join('\n'));
}

interface SourceCardProps {
  source: QueryResult;
  index: number;
}

export function SourceCard({ source, index }: SourceCardProps) {
  const docName =
    source.source_document || source.filename || "unknown";
  const score = source.score?.toFixed(3) || "N/A";
  const contentType = source.content_type || "text";
  const isImage = contentType === "image";

  const [expanded, setExpanded] = useState(false);
  const [textExpanded, setTextExpanded] = useState(isImage);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded || !containerRef.current) {
      setIsOverflowing(false);
      return;
    }

    const checkOverflow = () => {
      if (containerRef.current) {
        setIsOverflowing(containerRef.current.scrollHeight > 200);
      }
    };

    checkOverflow(); // Initial check

    const observer = new ResizeObserver(() => {
      checkOverflow();
    });
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [expanded, source.text]);

  return (
    <div
      style={{
        borderRadius: "var(--radius)",
        border: "1px solid var(--c-border)",
        background: "var(--bg-surface)",
        overflow: "hidden",
        transition: "all var(--dur-fast) var(--ease-spring)",
      }}
    >
      {/* Header row -- always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--c-muted)",
          textAlign: "left",
        }}
      >
        {isImage ? (
          <Image size={14} style={{ color: "var(--c-teal)", flexShrink: 0 }} />
        ) : (
          <FileText
            size={14}
            style={{ color: "var(--c-accent-mid)", flexShrink: 0 }}
          />
        )}
        <span
          style={{
            color: "var(--c-accent-mid)",
            fontWeight: 500,
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {docName}
        </span>
        <span style={{ color: "var(--c-muted)", fontWeight: 600 }}>
          {score}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 6px",
            borderRadius: 4,
            background: "rgba(255,255,255,0.06)",
            color: "var(--c-muted)",
            letterSpacing: "0.08em",
          }}
        >
          {contentType}
        </span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div
          style={{
            padding: "0 14px 14px",
            borderTop: "1px solid var(--c-border)",
            animation: "fadeIn 0.2s var(--ease-out)",
          }}
        >
          {/* Image preview if applicable */}
          {isImage && source.image_path && (
            <div style={{ marginTop: 12, marginBottom: 8 }}>
              <ImagePreview imagePath={source.image_path} alt={docName} />
            </div>
          )}

          {/* Text content */}
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.65,
              color: "var(--c-muted)",
              margin: "12px 0 0",
              fontFamily: "var(--font-display)",
              position: "relative",
            }}
          >
            <div
              ref={containerRef}
              style={{
                maxHeight: (isOverflowing && !textExpanded) ? 160 : "none",
                overflow: "hidden",
                position: "relative",
                transition: "max-height 0.3s ease",
              }}
            >
              <div className="markdown-body" style={{ overflowX: "auto" }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeRaw, rehypeKatex]}
                  components={{
                    p: (props: any) => <div className="markdown-p" style={{ margin: 0, marginBottom: "0.5em" }} {...props} />,
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
                  {preprocessText(source.display_text || source.text)}
                </ReactMarkdown>
              </div>
              {!textExpanded && isOverflowing && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 40,
                    background: "linear-gradient(to bottom, transparent, var(--bg-surface))",
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
            {isOverflowing && (
              <button
                onClick={() => setTextExpanded(!textExpanded)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--c-accent-mid)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  fontFamily: "var(--font-mono)",
                }}
              >
                {textExpanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>

          {/* Source tag */}
          <div style={{ marginTop: 10 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 4,
                background: "rgba(201,72,48,0.12)",
                color: "var(--c-accent-mid)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.06em",
              }}
            >
              Source {index + 1}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
