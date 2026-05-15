"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { X, Upload, FileText, CheckCircle, AlertCircle, Loader } from "lucide-react";
import { uploadDocument, fetchTaskStatus } from "@/lib/api";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UploadFile {
  file: File;
  status: "pending" | "uploading" | "processing" | "completed" | "failed";
  taskId?: string;
  message?: string;
}

export function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map((file) => ({
      file,
      status: "pending",
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: true,
  });

  const startUpload = async () => {
    const pendingFiles = files.filter((f) => f.status === "pending");

    for (let i = 0; i < pendingFiles.length; i++) {
      const uploadFile = pendingFiles[i];
      const fileIndex = files.findIndex((f) => f.file === uploadFile.file);

      // Mark as uploading
      setFiles((prev) => {
        const next = [...prev];
        next[fileIndex] = { ...next[fileIndex], status: "uploading" };
        return next;
      });

      try {
        const response = await uploadDocument(uploadFile.file);
        const taskId = response.task_id;

        // Mark as processing
        setFiles((prev) => {
          const next = [...prev];
          next[fileIndex] = {
            ...next[fileIndex],
            status: "processing",
            taskId,
          };
          return next;
        });

        // Poll for completion
        pollTaskStatus(fileIndex, taskId);
      } catch (err) {
        setFiles((prev) => {
          const next = [...prev];
          next[fileIndex] = {
            ...next[fileIndex],
            status: "failed",
            message: err instanceof Error ? err.message : "Upload failed",
          };
          return next;
        });
      }
    }
  };

  const pollTaskStatus = async (fileIndex: number, taskId: string) => {
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setFiles((prev) => {
          const next = [...prev];
          next[fileIndex] = {
            ...next[fileIndex],
            status: "failed",
            message: "Processing timed out",
          };
          return next;
        });
        return;
      }

      try {
        const status = await fetchTaskStatus(taskId);

        if (status.status === "completed") {
          setFiles((prev) => {
            const next = [...prev];
            next[fileIndex] = {
              ...next[fileIndex],
              status: "completed",
              message: `${status.chunks_created || 0} chunks created`,
            };
            return next;
          });
          return;
        }

        if (status.status === "failed") {
          setFiles((prev) => {
            const next = [...prev];
            next[fileIndex] = {
              ...next[fileIndex],
              status: "failed",
              message: status.message || "Processing failed",
            };
            return next;
          });
          return;
        }
      } catch {
        // Ignore polling errors, retry
      }

      attempts++;
      setTimeout(poll, 5000);
    };

    poll();
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    setFiles([]);
    onClose();
  };

  if (!isOpen) return null;

  const hasPending = files.some((f) => f.status === "pending");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
        animation: "fadeIn 0.2s var(--ease-out)",
      }}
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          background: "var(--bg-surface-raised)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--c-border)",
          boxShadow: "var(--shadow-lg)",
          padding: 0,
          animation: "fadeUp 0.3s var(--ease-out)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid var(--c-border)",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "var(--text-primary)",
                fontFamily: "var(--font-display)",
              }}
            >
              Upload Documents
            </h2>
            <p
              style={{
                fontSize: 12,
                color: "var(--c-muted)",
                marginTop: 2,
              }}
            >
              Ingest PDFs into your semantic knowledge base
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--c-muted)",
              cursor: "pointer",
              padding: 4,
              borderRadius: 6,
              display: "flex",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Dropzone */}
        <div style={{ padding: "20px 24px" }}>
          <div
            {...getRootProps()}
            style={{
              border: `1.5px dashed ${isDragActive ? "rgba(201,72,48,0.5)" : "var(--c-border-strong)"}`,
              borderRadius: 16,
              padding: "36px 24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              cursor: "pointer",
              transition: "all 0.3s",
              background: isDragActive
                ? "rgba(201,72,48,0.04)"
                : "transparent",
              position: "relative",
            }}
          >
            <input {...getInputProps()} />
            <div
              style={{
                width: 40,
                height: 40,
                background: "var(--c-surface)",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Upload size={20} style={{ color: "var(--c-muted)" }} />
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text-primary)",
                textAlign: "center",
                fontFamily: "var(--font-display)",
              }}
            >
              {isDragActive
                ? "Drop PDF files here"
                : "Drop PDF files here, or click to browse"}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--c-muted)",
                fontFamily: "var(--font-mono)",
                textAlign: "center",
              }}
            >
              Accepts .pdf -- Async processing via FastAPI background tasks
            </div>
          </div>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div style={{ padding: "0 24px 20px" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {files.map((uploadFile, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    background: "var(--bg-surface)",
                    borderRadius: 10,
                    border: "1px solid var(--c-border)",
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 34,
                      background: "rgba(201,72,48,0.2)",
                      borderRadius: 5,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                      fontWeight: 700,
                      color: "var(--c-accent-mid)",
                      fontFamily: "var(--font-mono)",
                      flexShrink: 0,
                    }}
                  >
                    PDF
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {uploadFile.file.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--c-muted)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {(uploadFile.file.size / (1024 * 1024)).toFixed(1)} MB
                      {uploadFile.message ? ` -- ${uploadFile.message}` : ""}
                    </div>
                  </div>
                  {/* Status indicator */}
                  {uploadFile.status === "pending" && (
                    <button
                      onClick={() => removeFile(idx)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--c-muted)",
                        cursor: "pointer",
                        padding: 2,
                        display: "flex",
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                  {(uploadFile.status === "uploading" ||
                    uploadFile.status === "processing") && (
                    <Loader
                      size={16}
                      style={{
                        color: "var(--c-amber)",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                  )}
                  {uploadFile.status === "completed" && (
                    <CheckCircle
                      size={16}
                      style={{ color: "#28C840" }}
                    />
                  )}
                  {uploadFile.status === "failed" && (
                    <AlertCircle
                      size={16}
                      style={{ color: "var(--c-coral)" }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "16px 24px",
            borderTop: "1px solid var(--c-border)",
          }}
        >
          <button
            onClick={handleClose}
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: "8px 16px" }}
          >
            {files.some((f) => f.status === "completed") ? "Done" : "Cancel"}
          </button>
          {hasPending && (
            <button
              onClick={startUpload}
              className="btn btn-accent"
              style={{ fontSize: 12, padding: "8px 16px" }}
            >
              Upload {files.filter((f) => f.status === "pending").length} file
              {files.filter((f) => f.status === "pending").length > 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
