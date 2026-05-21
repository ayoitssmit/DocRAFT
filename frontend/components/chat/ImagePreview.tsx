"use client";

import { useState } from "react";
import { API_URL } from "@/lib/constants";
import { ImageOff } from "lucide-react";

interface ImagePreviewProps {
  imagePath: string;
  alt: string;
}

export function ImagePreview({ imagePath, alt }: ImagePreviewProps) {
  const [error, setError] = useState(false);

  // Construct the URL: serve recursively from /images, handles Windows/Linux paths and subdirectories
  const cleanPath = imagePath.replace(/\\/g, "/");
  const imagesIndex = cleanPath.toLowerCase().indexOf("images/");
  
  let relativePath = "";
  if (imagesIndex !== -1) {
    relativePath = cleanPath.substring(imagesIndex + "images/".length);
  } else {
    relativePath = cleanPath.split("/").pop() || cleanPath;
  }
  
  const imageUrl = `${API_URL}/images/${relativePath}`;
  const filename = relativePath.split("/").pop() || relativePath;

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "24px 16px",
          borderRadius: "var(--radius-sm)",
          background: "var(--bg-surface-raised)",
          border: "1px solid var(--c-border)",
          color: "var(--c-muted)",
          fontSize: 12,
          fontFamily: "var(--font-mono)",
        }}
      >
        <ImageOff size={16} />
        Image unavailable
      </div>
    );
  }

  return (
    <div
      style={{
        borderRadius: "var(--radius-sm)",
        overflow: "hidden",
        border: "1px solid var(--c-border)",
        background: "var(--bg-surface-raised)",
      }}
    >
      <img
        src={imageUrl}
        alt={alt}
        onError={() => setError(true)}
        style={{
          width: "100%",
          maxHeight: 300,
          objectFit: "contain",
          display: "block",
        }}
      />
      <div
        style={{
          padding: "8px 12px",
          fontSize: 10,
          fontFamily: "var(--font-mono)",
          color: "var(--c-muted)",
          borderTop: "1px solid var(--c-border)",
        }}
      >
        {filename}
      </div>
    </div>
  );
}
