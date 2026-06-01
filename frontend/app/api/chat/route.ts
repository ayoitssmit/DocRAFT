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
    display_text?: string;
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
  // Use display_text as fallback when text is empty (e.g. image/table chunks where AI description is in display_text)
  const sourcesWithContent = sources.filter((s) => {
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
            return `[Source ${i + 1}] (${docName}, score: ${scoreStr}, type: ${contentType})\n${effectiveText}`;
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

      // Stream the actual LLM text chunks as they arrive
      try {
        for await (const chunk of result.textStream) {
          controller.enqueue(encoder.encode(chunk));
        }
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
