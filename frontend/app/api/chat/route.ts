import { streamText } from "ai";
import { createOllama } from "ai-sdk-ollama";
import { API_URL, MODEL_NAME, OLLAMA_HOST } from "@/lib/constants";

export const runtime = "nodejs";
export const maxDuration = 120;

const ollama = createOllama({
  baseURL: OLLAMA_HOST,
});

export async function POST(req: Request) {
  const { messages, data } = await req.json();

  // Extract the latest user message for RAG retrieval
  const lastUserMessage = messages
    .filter((m: { role: string }) => m.role === "user")
    .at(-1)?.content;

  if (!lastUserMessage) {
    return new Response("No user message found", { status: 400 });
  }

  const documentFilter = data?.documentFilter;

  // Step 1: Retrieve relevant chunks from our RAG backend
  let sources: Array<{
    id: string;
    score: number;
    text: string;
    filename?: string;
    source_document?: string;
    image_path?: string;
    content_type?: string;
  }> = [];

  try {
    const queryBody: Record<string, unknown> = {
      query: lastUserMessage,
      limit: 5,
    };
    if (documentFilter) {
      queryBody.document_filter = documentFilter;
    }

    const ragResponse = await fetch(`${API_URL}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(queryBody),
    });

    if (ragResponse.ok) {
      const ragData = await ragResponse.json();
      sources = ragData.results || [];
    }
  } catch (error) {
    console.error("RAG retrieval failed:", error);
    // Continue without RAG context -- the model will answer from its own knowledge
  }

  // Step 2: Build context block from retrieved chunks
  const contextBlock =
    sources.length > 0
      ? sources
          .map((s, i) => {
            const docName = s.source_document || s.filename || "unknown";
            const scoreStr = s.score?.toFixed(3) || "N/A";
            const contentType = s.content_type || "text";
            return `[Source ${i + 1}] (${docName}, score: ${scoreStr}, type: ${contentType})\n${s.text}`;
          })
          .join("\n\n---\n\n")
      : "No relevant documents found in the knowledge base.";

  // Step 3: Build system prompt
  const systemPrompt = `You are DocRAFT, an enterprise-grade document analysis assistant built for technical knowledge extraction.

Your behavior:
- Answer questions using ONLY the retrieved context below. Do not fabricate information.
- If the context does not contain the answer, clearly state: "I could not find this information in the uploaded documents."
- Cite sources using [Source N] notation when referencing specific chunks.
- Format responses using Markdown: use headers, bullet points, code blocks, and tables where appropriate.
- Be precise, technical, and concise. Avoid filler language.
- When presenting tabular data from the context, preserve the table format.

--- Retrieved Context ---
${contextBlock}
--- End Context ---`;

  // Step 4: Stream the LLM response
  const result = await streamText({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: ollama(MODEL_NAME),
    system: systemPrompt,
    messages,
  });

  // Step 5: Return the stream with sources attached as custom headers
  return result.toTextStreamResponse({
    headers: {
      "X-Sources": encodeURIComponent(JSON.stringify(sources)),
    },
  });
}
