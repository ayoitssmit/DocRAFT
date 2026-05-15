export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

const STORAGE_KEY = "docraftSessions";
const MAX_SESSIONS = 50;

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  documentFilter: string | null;
  createdAt: string;
  updatedAt: string;
}

export function getSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ChatSession[];
  } catch {
    return [];
  }
}

export function getSession(id: string): ChatSession | null {
  const sessions = getSessions();
  return sessions.find((s) => s.id === id) ?? null;
}

export function saveSession(session: ChatSession): void {
  const sessions = getSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);

  if (idx >= 0) {
    sessions[idx] = session;
  } else {
    sessions.unshift(session);
  }

  // Enforce max sessions limit
  const trimmed = sessions.slice(0, MAX_SESSIONS);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage might be full, remove oldest sessions
    const reduced = trimmed.slice(0, Math.floor(MAX_SESSIONS / 2));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reduced));
  }
}

export function deleteSession(id: string): void {
  const sessions = getSessions().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function clearAllSessions(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function createNewSession(): ChatSession {
  return {
    id: crypto.randomUUID(),
    title: "New Chat",
    messages: [],
    documentFilter: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function generateSessionTitle(firstMessage: string | undefined): string {
  if (!firstMessage) return "New Chat";
  const cleaned = firstMessage.trim().replace(/\n/g, " ");
  return cleaned.length > 50 ? cleaned.slice(0, 50) + "..." : cleaned;
}
