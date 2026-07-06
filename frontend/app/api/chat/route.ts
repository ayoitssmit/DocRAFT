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

  // Extract the latest user message for RAG retrieval
  const lastUserMessage = messages
    .filter((m: { role: string }) => m.role === "user")
    .at(-1)?.content;

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

  // Step 1: Retrieve relevant chunks from our RAG backend
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

  try {
    // Build a contextual query from the last 3 user turns so that follow-up
    // questions like "tell me more about this document" carry enough context
    // for the retriever to find the right document rather than a random one.
    const recentUserMessages: string[] = messages
      .filter((m: { role: string }) => m.role === "user")
      .slice(-3)
      .map((m: { content: string }) => m.content);
    const ragQuery = recentUserMessages.join(" | ");

    const queryBody: Record<string, unknown> = {
      query: ragQuery,
      limit: 5,
    };
    if (documentFilter && documentFilter.length > 0) {
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

  // Step 2: Build context block from retrieved chunks.
  // - Filter out sources below a minimum reranker score (cross-encoder noise floor).
  // - Use display_text as fallback when text is empty (image/table chunks store
  //   the AI-generated description in display_text, not text).
  const MIN_SCORE = 0.005;
  const sourcesWithContent = sources.filter((s) => {
    if (s.score < MIN_SCORE) return false;
    const effectiveText = s.text || s.display_text || "";
    return effectiveText.trim().length > 0;
  });

  const contextBlock =
    sourcesWithContent.length > 0
      ? sourcesWithContent
          .map((s, i) => {
            const docName = s.source_document || s.filename || "unknown";
            const scoreStr = s.score?.toFixed(3) || "N/A";
            const contentType = s.content_type || "text";
            // Prefer text, fall back to display_text for image/table nodes
            const effectiveText = s.text || s.display_text || "";
            const cappedText = effectiveText.length > 600 ? effectiveText.substring(0, effectiveText.lastIndexOf(" ", 600)) + "..." : effectiveText;
            return `[Source ${i + 1}] (${docName}, score: ${scoreStr}, type: ${contentType})\n${cappedText}`;
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
- When expressing any mathematical formula, equation, or symbol from the context, always wrap inline math in single dollar signs ($...$) and display/block equations in double dollar signs ($$...$$). Never output raw LaTeX commands without delimiters. For example: write $x_t$ not x_t, and $$\nabla_x E\left(\hat{c}^{attr}, x_t, t\right)$$ not the raw command string.

--- Retrieved Context ---
${contextBlock}
--- End Context ---`;

  // Step 4: Stream the LLM response
  const result = await streamText({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: ollama(MODEL_NAME),
    system: systemPrompt,
    messages,
    providerOptions: {
      ollama: { num_ctx: 4096 },
    },
  });

  const safeSources = sources.map(s => ({
    ...s,
    text: s.text
  }));

  // Step 5: Construct a custom stream containing sources as a prefix inside an HTML comment tag
  const encoder = new TextEncoder();
  const customStream = new ReadableStream({
    async start(controller) {
      // Stream sources as the very first packet (base64 encoded to avoid delimiter collision in document text)
      const base64Sources = Buffer.from(JSON.stringify(safeSources)).toString("base64");
      const sourcesPrefix = `<!--SOURCES:${base64Sources}-->`;
      controller.enqueue(encoder.encode(sourcesPrefix));

      // Stream LLM response AND accumulate it for caching
      let accumulatedResponse = "";
      try {
        for await (const chunk of result.textStream) {
          accumulatedResponse += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
        // Store in Layer 2 cache after full response is accumulated
        setCachedResponse(
          lastUserMessage,
          documentFilter ?? null,
          safeSources,
          accumulatedResponse
        );
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(customStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
