import { streamText } from "ai";
import { createOllama } from "ai-sdk-ollama";
import { API_URL, MODEL_NAME, OLLAMA_HOST } from "@/lib/constants";
import { getCachedResponse, setCachedResponse } from "@/lib/response-cache";

export const runtime = "nodejs";
export const maxDuration = 120;

const ollama = createOllama({
  baseURL: OLLAMA_HOST,
});

export async function POST(req: Request) {
  const { messages, data } = await req.json();
  console.log("DEBUG: Received messages history:", JSON.stringify(messages, null, 2));

  // Extract the latest user message for RAG retrieval
  const lastUserMessage = messages
    .filter((m: { role: string }) => m.role === "user")
    .at(-1)?.content;
  console.log("DEBUG: Resolved lastUserMessage:", lastUserMessage);

  if (!lastUserMessage) {
    return new Response("No user message found", { status: 400 });
  }

  const documentFilter = data?.documentFilter;

  // ── Layer 2 cache lookup ─────────────────────────────────────────
  const cachedEntry = getCachedResponse(lastUserMessage, documentFilter ?? null);
  if (cachedEntry) {
    // Stream the cached LLM response character by character to preserve
    // the streaming feel. Sources are injected as the first packet exactly
    // the same way as a live response so the frontend receives identical structure.
    const encoder = new TextEncoder();
    const cachedStream = new ReadableStream({
      async start(controller) {
        const base64Sources = Buffer.from(
          JSON.stringify(cachedEntry.sources)
        ).toString("base64");
        controller.enqueue(
          encoder.encode(`<!--SOURCES:${base64Sources}-->`)
        );
        // Stream cached text in small chunks to preserve streaming UX
        const chunkSize = 8;
        for (let i = 0; i < cachedEntry.llmResponse.length; i += chunkSize) {
          controller.enqueue(
            encoder.encode(cachedEntry.llmResponse.slice(i, i + chunkSize))
          );
          // Small delay to avoid overwhelming the client
          await new Promise((r) => setTimeout(r, 2));
        }
        controller.close();
      },
    });
    return new Response(cachedStream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  // ── End cache lookup ─────────────────────────────────────────────

  // Step 1: Call the stateful Critic-Generator LangGraph on our backend
  let sources: Array<{
    id: string;
    score: number;
    text: string;
    display_text?: string;
    filename?: string;
    source_document?: string;
    image_path?: string;
    content_type?: string;
  }> = [];
  let responseText = "";

  try {
    let cleanMessages = messages.slice(-5);
    if (cleanMessages.length > 0 && cleanMessages[0].role === "assistant") {
      cleanMessages = cleanMessages.slice(1);
    }

    const backendResponse = await fetch(`${API_URL}/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: lastUserMessage,
        messages: cleanMessages,
        document_filter: documentFilter
      }),
    });

    if (backendResponse.ok) {
      const data = await backendResponse.json();
      responseText = data.response || "No response received.";
      sources = data.sources || [];
    } else {
      const errorText = await backendResponse.text();
      console.error("Backend agent API failed:", errorText);
      responseText = "Failed to fetch response from the RAG agent backend.";
    }
  } catch (error) {
    console.error("Backend agent connection failed:", error);
    responseText = "Failed to connect to the RAG agent backend.";
  }

  const safeSources = sources.map(s => ({
    ...s,
    text: s.text
  }));

  // Step 2: Stream the LLM response in chunks to preserve the streaming UX
  const encoder = new TextEncoder();
  const customStream = new ReadableStream({
    async start(controller) {
      // Stream sources as the very first packet (base64 encoded to avoid delimiter collision in document text)
      const base64Sources = Buffer.from(JSON.stringify(safeSources)).toString("base64");
      const sourcesPrefix = `<!--SOURCES:${base64Sources}-->`;
      controller.enqueue(encoder.encode(sourcesPrefix));

      // Stream text chunk by chunk
      const chunkSize = 16;
      for (let i = 0; i < responseText.length; i += chunkSize) {
        controller.enqueue(encoder.encode(responseText.slice(i, i + chunkSize)));
        // Tiny sleep to make the streaming text appear progressively smooth
        await new Promise((r) => setTimeout(r, 4));
      }
      
      // Store in Layer 2 cache after full response is generated
      setCachedResponse(
        lastUserMessage,
        documentFilter ?? null,
        safeSources,
        responseText
      );
      
      controller.close();
    },
  });

  return new Response(customStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
