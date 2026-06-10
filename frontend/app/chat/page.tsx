"use client";

import { useState, useEffect, useCallback, useRef } from "react";

import { Sidebar } from "@/components/layout/Sidebar";
import { ChatHeader } from "@/components/layout/ChatHeader";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ChatInput } from "@/components/chat/ChatInput";
import { UploadModal } from "@/components/upload/UploadModal";
import {
  getSessions,
  getSession,
  saveSession,
  deleteSession,
  createNewSession,
  generateSessionTitle,
  type ChatSession,
  type Message,
} from "@/lib/chatStorage";
import type { QueryResult } from "@/lib/api";

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [documentFilter, setDocumentFilter] = useState<string | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [sourcesMap, setSourcesMap] = useState<Record<string, QueryResult[]>>(
    {}
  );
  const initializedRef = useRef(false);

  // Initialize sessions from localStorage
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const stored = getSessions();
    if (stored.length > 0) {
      setSessions(stored);
      setActiveSessionId(stored[0].id);
    } else {
      const newSession = createNewSession();
      saveSession(newSession);
      setSessions([newSession]);
      setActiveSessionId(newSession.id);
    }
  }, []);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Helper to send message manually
  const sendMessage = async ({ text }: { text: string }) => {
    if (!text.trim() || isLoading) return;

    const userMessage = { id: Date.now().toString(), role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          data: { documentFilter }
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      const assistantId = (Date.now() + 1).toString();

      // Add initial assistant message
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

      if (reader) {
        let sourcesExtracted = false;
        let localSources: QueryResult[] | undefined = undefined;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          assistantContent += chunk;

          // Check if we can extract sources from the prefix HTML comment tag
          if (!sourcesExtracted && assistantContent.startsWith("<!--SOURCES:")) {
            const closingTagIndex = assistantContent.indexOf("-->");
            if (closingTagIndex !== -1) {
              const base64Str = assistantContent.substring("<!--SOURCES:".length, closingTagIndex);
              try {
                const binString = atob(base64Str);
                const bytes = Uint8Array.from(binString, (m) => m.codePointAt(0)!);
                const jsonStr = new TextDecoder().decode(bytes);
                const parsedSources: QueryResult[] = JSON.parse(jsonStr);
                setSourcesMap((prev) => ({
                  ...prev,
                  [assistantId]: parsedSources,
                }));
                localSources = parsedSources;
              } catch (e) {
                console.error("Failed to parse streamed sources:", e);
              }
              // Strip the sources prefix from the displayed content
              assistantContent = assistantContent.substring(closingTagIndex + "-->".length);
              sourcesExtracted = true;
            }
          }

          // Update the assistant message in place (excluding the prefix if parsed, or keeping it if still loading)
          setMessages((prev) => 
            prev.map(m => m.id === assistantId ? { 
              ...m, 
              content: sourcesExtracted 
                ? assistantContent 
                : (assistantContent.startsWith("<!--") 
                    ? "" 
                    : assistantContent),
              sources: localSources
            } : m)
          );
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const [input, setInput] = useState("");

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      // In SDK v6, sendMessage expects an object with a 'text' property
      sendMessage({ text: input });
      setInput("");
    }
  };


  // Auto-save messages to active session whenever messages change
  useEffect(() => {
    if (!activeSessionId || messages.length === 0) return;

    const session = getSession(activeSessionId);
    if (!session) return;

    const updated: ChatSession = {
      ...session,
      messages,
      documentFilter,
      updatedAt: new Date().toISOString(),
    };

    // Auto-title from first user message
    if (session.title === "New Chat" && messages.length >= 1) {
      const firstUserMsg = messages.find((m: any) => m.role === "user");
      if (firstUserMsg) {
        updated.title = generateSessionTitle(firstUserMsg.content);
      }
    }

    saveSession(updated);
    setSessions((prev) =>
      prev.map((s: any) => (s.id === activeSessionId ? updated : s))
    );
  }, [messages, activeSessionId, documentFilter]);

  const handleNewChat = useCallback(() => {
    const newSession = createNewSession();
    saveSession(newSession);
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setMessages([]);
    setDocumentFilter(null);
    setSourcesMap({});
  }, [setMessages]);

  const handleSelectSession = useCallback(
    (id: string) => {
      const session = getSession(id);
      if (session) {
        setActiveSessionId(id);
        setMessages(session.messages);
        setDocumentFilter(session.documentFilter);
        setSourcesMap({});
      }
    },
    [setMessages]
  );

  const handleDeleteSession = useCallback(
    (id: string) => {
      deleteSession(id);
      const remaining = getSessions();

      if (remaining.length === 0) {
        // Create a fresh session
        const newSession = createNewSession();
        saveSession(newSession);
        setSessions([newSession]);
        setActiveSessionId(newSession.id);
        setMessages([]);
      } else {
        setSessions(remaining);
        if (activeSessionId === id) {
          setActiveSessionId(remaining[0].id);
          setMessages(remaining[0].messages);
        }
      }
      setSourcesMap({});
    },
    [activeSessionId, setMessages]
  );

  // Sync messages when active session changes
  useEffect(() => {
    if (activeSession) {
      setMessages(activeSession.messages || []);

      // Load sources from messages into the in-memory sourcesMap
      const newSourcesMap: Record<string, QueryResult[]> = {};
      activeSession.messages.forEach((m) => {
        if (m.sources) {
          newSourcesMap[m.id] = m.sources;
        }
      });
      setSourcesMap(newSourcesMap);
    } else {
      setMessages([]);
      setSourcesMap({});
    }
  }, [activeSessionId]);

  const handleDocumentFilter = useCallback((docName: string | null) => {
    setDocumentFilter(docName);
  }, []);

  // Keyboard shortcut: Ctrl+N for new chat
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        handleNewChat();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleNewChat]);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        background: "var(--bg-app-shell)",
      }}
    >
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onUploadClick={() => setUploadModalOpen(true)}
        onDocumentFilter={handleDocumentFilter}
        activeFilter={documentFilter}
      />

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        <ChatHeader
          activeFilter={documentFilter}
          onClearFilter={() => setDocumentFilter(null)}
          onUploadClick={() => setUploadModalOpen(true)}
        />

        <ChatWindow
          messages={messages}
          isLoading={isLoading}
          sourcesMap={sourcesMap}
        />

        <ChatInput
          input={input}
          onChange={handleInputChange}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </main>

      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
      />
    </div>
  );
}
