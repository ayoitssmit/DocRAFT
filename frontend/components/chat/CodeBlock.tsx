"use client";

import React, { useState } from "react";
import SyntaxHighlighter from "react-syntax-highlighter";
import { monokaiSublime } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  language: string;
  value: string;
}

export function CodeBlock({ language, value }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  return (
    <div className="relative group my-4 rounded-md overflow-hidden bg-[#23241f] border border-gray-700">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1e1e1e] text-xs text-gray-400 border-b border-gray-700">
        <span className="lowercase font-mono">{language || "text"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 hover:text-white transition-colors bg-transparent border-none cursor-pointer text-gray-400"
          title="Copy code"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? "Copied!" : "Copy"}</span>
        </button>
      </div>
      <div className="text-sm">
        <SyntaxHighlighter
          language={language || "text"}
          style={monokaiSublime}
          customStyle={{ margin: 0, padding: "16px", background: "transparent" }}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
