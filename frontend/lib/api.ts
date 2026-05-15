import { API_URL } from "./constants";

/* ---- Types ---- */
export interface HealthData {
  status: string;
  environment: string;
  timestamp: string;
  version: string;
}

export interface QueryResult {
  id: string;
  score: number;
  text: string;
  filename?: string;
  source_document?: string;
  image_path?: string;
  content_type?: string;
}

export interface DocumentItem {
  id: string;
  filename?: string;
  source_document?: string;
  content_preview: string;
}

export interface UploadResponse {
  task_id: string;
  status: string;
  message: string;
}

export interface TaskStatus {
  status: "queued" | "processing" | "completed" | "failed";
  filename: string;
  chunks_created?: number;
  message?: string;
}

/* ---- API Functions ---- */

export async function fetchHealth(): Promise<HealthData> {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function queryDocuments(
  query: string,
  limit: number = 5,
  documentFilter?: string
): Promise<{ results: QueryResult[] }> {
  const body: Record<string, unknown> = { query, limit };
  if (documentFilter) body.document_filter = documentFilter;

  const res = await fetch(`${API_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchDocuments(): Promise<{
  documents: DocumentItem[];
}> {
  const res = await fetch(`${API_URL}/documents`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function uploadDocument(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchTaskStatus(taskId: string): Promise<TaskStatus> {
  const res = await fetch(`${API_URL}/status/${taskId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
