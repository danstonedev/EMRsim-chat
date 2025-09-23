import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getPTPrompt } from "@/lib/prompts/ptCases";
import { getFacultySettings } from "@/lib/config/faculty";
import { SAFETY_WRAPPER_PROMPT } from "@/lib/prompts/safety";
import {
  resolvePersonaPromptByScenarioId,
  isAllowedScenario,
} from "@/lib/prompts/allowlist";

export const runtime = "nodejs";

// Request deduplication cache
const pendingRequests = new Map<string, Promise<Response>>();

// Response caching for common queries (short-lived)
const responseCache = new Map<
  string,
  { response: string; timestamp: number }
>();
const CACHE_DURATION = 30000; // 30 seconds

type HistoryMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

function generateRequestKey(
  message: string,
  history: HistoryMessage[],
  scenario: string
): string {
  // Create a hash-like key for deduplication
  const historyKey = history
    .slice(-4)
    .map((h) => `${h.role}:${h.content.slice(0, 50)}`)
    .join("|");
  return `${scenario}:${message.slice(0, 100)}:${historyKey}`;
}

function getCachedResponse(key: string): string | null {
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.response;
  }
  if (cached) {
    responseCache.delete(key);
  }
  return null;
}

function setCachedResponse(key: string, response: string): void {
  // Limit cache size
  if (responseCache.size > 50) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
  responseCache.set(key, { response, timestamp: Date.now() });
}

export async function POST(req: Request) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();

    // Optimized body parsing
    let body: any = null;
    let rawText = "";

    try {
      if (ct.includes("application/json")) {
        body = await req.json();
      } else {
        rawText = await req.text();
        if (rawText.trim().startsWith("{") && rawText.trim().endsWith("}")) {
          body = JSON.parse(rawText);
        }
      }
    } catch (e) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Body parsing failed:", e);
      }
    }

    // Extract message and history
    let message: string | null = null;
    let history: HistoryMessage[] = [];

    if (body && typeof body === "object") {
      if (typeof body.message === "string") message = body.message;
      if (Array.isArray(body.history)) {
        history = body.history
          .filter(
            (m: any) =>
              m &&
              typeof m.content === "string" &&
              (m.role === "user" ||
                m.role === "assistant" ||
                m.role === "system")
          )
          .slice(-16); // Limit history for performance
      }
    } else if (rawText) {
      message = rawText;
    }

    if (!message && history.length === 0) {
      return NextResponse.json(
        {
          error: 'No message provided. Include {"message":"..."} in JSON body.',
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "Missing OPENAI_API_KEY on server. Add it to .env.local",
        },
        { status: 500 }
      );
    }

    const faculty = getFacultySettings();

    // Resolve scenario
    let requestedScenario = faculty.scenarioId;
    const hdrScenario = req.headers.get("x-pt-scenario") || undefined;
    if (faculty.enableClientScenario && isAllowedScenario(hdrScenario || "")) {
      requestedScenario = hdrScenario || requestedScenario;
    } else if (
      faculty.enableClientScenario &&
      body?.scenario &&
      isAllowedScenario(body.scenario)
    ) {
      requestedScenario = body.scenario;
    }

    // Generate request key for deduplication and caching
    const requestKey = generateRequestKey(
      message || "",
      history,
      requestedScenario || "default"
    );

    // Check for duplicate request
    if (pendingRequests.has(requestKey)) {
      return pendingRequests.get(requestKey)!;
    }

    // Check cache for recent identical requests
    const cachedResponse = getCachedResponse(requestKey);
    if (cachedResponse) {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const encoder = new TextEncoder();
          const send = (data: string) =>
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));

          // Send cached response in chunks for streaming experience
          const chunks = cachedResponse.match(/.{1,10}/g) || [cachedResponse];
          chunks.forEach((chunk, index) => {
            setTimeout(() => send(chunk), index * 20);
          });

          setTimeout(() => {
            controller.enqueue(encoder.encode(`event: done\ndata: [DONE]\n\n`));
            controller.close();
          }, chunks.length * 20 + 50);
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // Create and cache the response promise
    const responsePromise = generateStreamingResponse(
      message,
      history,
      requestedScenario,
      requestKey
    );
    pendingRequests.set(requestKey, responsePromise);

    // Clean up the pending request after completion
    responsePromise.finally(() => {
      pendingRequests.delete(requestKey);
    });

    return responsePromise;
  } catch (err) {
    console.error("API /api/chat error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

async function generateStreamingResponse(
  message: string | null,
  history: HistoryMessage[],
  scenarioId: string | undefined,
  requestKey: string
): Promise<Response> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const personaPrompt = resolvePersonaPromptByScenarioId(scenarioId);

  const messages: { role: "system" | "user" | "assistant"; content: string }[] =
    [];
  messages.push({ role: "system", content: SAFETY_WRAPPER_PROMPT });
  messages.push({ role: "system", content: personaPrompt });

  if (history.length) {
    messages.push(
      ...history.map((m) => ({
        role: m.role === "system" ? "user" : m.role,
        content: m.content,
      }))
    );
  }

  if (message) {
    messages.push({ role: "user", content: message });
  }

  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      const encoder = new TextEncoder();
      const send = (data: string) =>
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      const sendComment = (comment: string) =>
        controller.enqueue(encoder.encode(`: ${comment}\n\n`));

      let fullResponse = "";

      try {
        sendComment("stream-start");

        const resp = await client.chat.completions.create({
          model: "gpt-4o-mini",
          stream: true,
          temperature: 0.5,
          presence_penalty: 0.0,
          frequency_penalty: 0.0,
          max_tokens: 500, // Limit for faster responses
          messages,
        });

        for await (const part of resp) {
          const delta = part.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length) {
            fullResponse += delta;
            send(delta);
          }
        }

        // Cache the complete response
        if (fullResponse.trim()) {
          setCachedResponse(requestKey, fullResponse.trim());
        }

        controller.enqueue(encoder.encode(`event: done\ndata: [DONE]\n\n`));
        controller.close();
      } catch (e: any) {
        try {
          send(JSON.stringify({ error: e?.message || "stream_error" }));
        } finally {
          controller.close();
        }
      }
    },
    cancel() {
      // Cleanup on cancellation
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
