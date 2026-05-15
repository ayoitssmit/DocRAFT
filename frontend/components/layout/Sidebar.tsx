"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Search,
  Upload,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  MessageSquare,
} from "lucide-react";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { fetchHealth, fetchDocuments, type HealthData, type DocumentItem } from "@/lib/api";
import type { ChatSession } from "@/lib/chatStorage";

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onUploadClick: () => void;
  onDocumentFilter: (docName: string | null) => void;
  activeFilter: string | null;
}

export function Sidebar({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onUploadClick,
  onDocumentFilter,
  activeFilter,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);

  // Restore collapse state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("docraftSidebarCollapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  // Poll health every 15s
  useEffect(() => {
    const poll = () => {
      fetchHealth()
        .then((data) => {
          setHealth(data);
          setHealthError(false);
        })
        .catch(() => setHealthError(true));
    };
    poll();
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, []);

  // Poll documents every 30s
  useEffect(() => {
    const poll = () => {
      fetchDocuments()
        .then((data) => setDocuments(data.documents))
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("docraftSidebarCollapsed", String(next));
  };

  // Deduplicate documents by filename
  const uniqueDocs = documents.reduce<DocumentItem[]>((acc, doc) => {
    const name = doc.source_document || doc.filename || "unknown";
    if (!acc.find((d) => (d.source_document || d.filename) === name)) {
      acc.push(doc);
    }
    return acc;
  }, []);

  return (
    <aside
      style={{
        width: collapsed ? 56 : 240,
        background: "var(--bg-sidebar)",
        borderRight: "1px solid var(--c-border)",
        display: "flex",
        flexDirection: "column",
        transition: "width var(--dur-base) var(--ease-spring)",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Logo + Collapse */}
      <div
        style={{
          padding: collapsed ? "16px 10px" : "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: 8,
        }}
      >
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 24,
                height: 24,
                background: "var(--c-accent)",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 800,
                color: "white",
                letterSpacing: "-0.05em",
                fontFamily: "var(--font-display)",
              }}
            >
              DR
            </div>
            <span
              style={{
                fontSize: 16,
                fontWeight: 800,
                letterSpacing: "-0.04em",
                color: "var(--text-primary)",
                fontFamily: "var(--font-display)",
                whiteSpace: "nowrap",
              }}
            >
              DocRAFT
            </span>
          </div>
        )}
        <button
          onClick={toggleCollapse}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--c-muted)",
            cursor: "pointer",
            padding: 4,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "color var(--dur-fast)",
          }}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Action buttons */}
      <div
        style={{
          padding: collapsed ? "0 6px" : "0 12px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <button
          onClick={onNewChat}
          className="sidebar-action-btn"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: collapsed ? "9px 0" : "9px 12px",
            justifyContent: collapsed ? "center" : "flex-start",
            borderRadius: "var(--radius-sm)",
            border: "none",
            background: "rgba(201,72,48,0.15)",
            color: "var(--c-accent-mid)",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "var(--font-display)",
            transition: "all var(--dur-fast)",
            width: "100%",
          }}
        >
          <Plus size={16} />
          {!collapsed && "New Chat"}
        </button>
        <button
          onClick={onUploadClick}
          className="sidebar-action-btn"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: collapsed ? "9px 0" : "9px 12px",
            justifyContent: collapsed ? "center" : "flex-start",
            borderRadius: "var(--radius-sm)",
            border: "none",
            background: "transparent",
            color: "var(--c-muted)",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
            fontFamily: "var(--font-display)",
            transition: "all var(--dur-fast)",
            width: "100%",
          }}
        >
          <Upload size={16} />
          {!collapsed && "Upload Document"}
        </button>
      </div>

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: collapsed ? "0 6px" : "0 12px",
        }}
      >
        {/* Chat History */}
        {!collapsed && sessions.length > 0 && (
          <>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
                color: "var(--c-muted)",
                padding: "16px 12px 6px",
                fontFamily: "var(--font-mono)",
              }}
            >
              Chat History
            </div>
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: "var(--font-display)",
                  color:
                    session.id === activeSessionId
                      ? "var(--text-primary)"
                      : "var(--c-muted)",
                  background:
                    session.id === activeSessionId
                      ? "rgba(201,72,48,0.2)"
                      : "transparent",
                  transition: "all var(--dur-fast)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  position: "relative",
                }}
              >
                <MessageSquare
                  size={14}
                  style={{ flexShrink: 0, opacity: 0.7 }}
                />
                <span
                  style={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {session.title}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--c-muted)",
                    cursor: "pointer",
                    padding: 2,
                    borderRadius: 4,
                    display: "flex",
                    opacity: 0.5,
                    transition: "opacity var(--dur-fast)",
                    flexShrink: 0,
                  }}
                  aria-label="Delete session"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </>
        )}

        {/* Documents */}
        {!collapsed && uniqueDocs.length > 0 && (
          <>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
                color: "var(--c-muted)",
                padding: "16px 12px 6px",
                fontFamily: "var(--font-mono)",
              }}
            >
              Documents
            </div>
            {uniqueDocs.map((doc) => {
              const docName =
                doc.source_document || doc.filename || "unknown";
              const isActive = activeFilter === docName;
              return (
                <div
                  key={doc.id}
                  onClick={() =>
                    onDocumentFilter(isActive ? null : docName)
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 500,
                    fontFamily: "var(--font-display)",
                    color: isActive
                      ? "var(--text-primary)"
                      : "var(--c-muted)",
                    background: isActive
                      ? "rgba(30,122,140,0.2)"
                      : "transparent",
                    transition: "all var(--dur-fast)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  <FileText
                    size={14}
                    style={{ flexShrink: 0, opacity: 0.7 }}
                  />
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {docName}
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Footer: Health + Theme */}
      <div
        style={{
          padding: collapsed ? "12px 6px" : "12px 16px",
          borderTop: "1px solid var(--c-border)",
          display: "flex",
          alignItems: collapsed ? "center" : "center",
          justifyContent: collapsed ? "center" : "space-between",
          flexDirection: collapsed ? "column" : "row",
          gap: collapsed ? 8 : 0,
        }}
      >
        {/* Health dots */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: collapsed ? 6 : 12,
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: 6 }}
            title={`Ollama: ${health && !healthError ? "Healthy" : "Down"}`}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background:
                  health && !healthError ? "#28C840" : "#FF5F57",
                animation:
                  health && !healthError ? "pulse 2s ease-in-out infinite" : "none",
              }}
            />
            {!collapsed && (
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  color: "var(--c-muted)",
                }}
              >
                Ollama
              </span>
            )}
          </div>
          <div
            style={{ display: "flex", alignItems: "center", gap: 6 }}
            title={`Qdrant: ${health && !healthError ? "Healthy" : "Down"}`}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background:
                  health && !healthError ? "#28C840" : "#FF5F57",
                animation:
                  health && !healthError ? "pulse 2s ease-in-out infinite" : "none",
              }}
            />
            {!collapsed && (
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  color: "var(--c-muted)",
                }}
              >
                Qdrant
              </span>
            )}
          </div>
        </div>

        {/* Theme toggle */}
        <ThemeToggle />
      </div>
    </aside>
  );
}
