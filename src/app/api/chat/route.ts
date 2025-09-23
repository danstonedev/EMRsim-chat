import { NextResponse } from "next/server";
import { getPTPrompt } from "@/lib/prompts/ptCases";
import { getFacultySettings } from "@/lib/config/faculty";
import { SAFETY_WRAPPER_PROMPT } from "@/lib/prompts/safety";
import { getOpenAIClient } from "@/lib/openai/client";
import {
  resolvePersonaPromptByScenarioId,
  isAllowedScenario,
} from "@/lib/prompts/allowlist";

export const runtime = "nodejs";

type HistoryMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export async function POST(req: Request) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();

    // Clone first so we can optionally read as JSON if needed
    const reqClone = req.clone();
    // Read raw text once to avoid body-stream reuse issues
    const raw = await req.text().catch(() => "");

    if (process.env.NODE_ENV !== "production") {
      console.log("POST /api/chat incoming:", {
        ct,
        rawPreview: raw.slice(0, 200),
      });
    }

    let message: string | null = null;
    // Client-provided system prompt is intentionally ignored for safety
    let _clientSystemPrompt: string | null = null;
    let history: HistoryMessage[] = [];

    if (
      ct.includes("application/json") ||
      (raw.trim().startsWith("{") && raw.trim().endsWith("}"))
    ) {
      let body: any = null;
      // Try parse from raw first
      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch (e) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("Failed to parse raw JSON body:", e);
          }
        }
      }
      // Fallback to reading JSON from the cloned request (helps in quirky clients)
      if (!body) {
        try {
          body = await reqClone.json();
        } catch (e) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("Failed to parse cloned JSON body:", e);
          }
        }
      }
      if (body && typeof body === "object") {
        if (typeof body.message === "string") message = body.message;
        if (typeof body.systemPrompt === "string")
          _clientSystemPrompt = body.systemPrompt;
        if (Array.isArray(body.history)) {
          history = body.history.filter(
            (m: any) =>
              m &&
              typeof m.content === "string" &&
              (m.role === "user" ||
                m.role === "assistant" ||
                m.role === "system")
          );
        }
      }
    } else if (ct.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(raw);
      const msg = params.get("message");
      if (msg) message = msg;
      // Ignore client system prompt in URL-encoded form as well
    } else if (raw) {
      // Treat plain text as the message
      message = raw;
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("POST /api/chat parsed:", {
        message,
        hasHistory: history.length > 0,
      });
    }

    if (!message && history.length === 0) {
      return NextResponse.json(
        {
          error: 'No message provided. Include {"message":"..."} in JSON body.',
        },
        { status: 400 }
      );
    }

    // Use singleton OpenAI client for better performance (eliminates cold start)
    const client = getOpenAIClient();

    const faculty = getFacultySettings();
    // Resolve scenario with server-side allowlist. If client passes a header or body, only accept if allowlist contains it AND faculty enables client scenarios.
    let requestedScenario: string | undefined = faculty.scenarioId;
    const hdrScenario = req.headers.get("x-pt-scenario") || undefined;
    if (faculty.enableClientScenario && isAllowedScenario(hdrScenario || "")) {
      requestedScenario = hdrScenario || requestedScenario;
    } else if (faculty.enableClientScenario) {
      // Try body.scenario if present and allowed
      try {
        const parsed = raw ? JSON.parse(raw) : null;
        if (
          parsed &&
          typeof parsed.scenario === "string" &&
          isAllowedScenario(parsed.scenario)
        ) {
          requestedScenario = parsed.scenario;
        }
      } catch {}
    }

    const personaPrompt = resolvePersonaPromptByScenarioId(requestedScenario);
    const messages: {
      role: "system" | "user" | "assistant";
      content: string;
    }[] = [];
    // Non-overrideable safety wrapper first, then persona
    messages.push({ role: "system", content: SAFETY_WRAPPER_PROMPT });
    messages.push({ role: "system", content: personaPrompt });
    if (history.length)
      messages.push(
        ...history.map((m) => ({
          role: m.role === "system" ? "user" : m.role,
          content: m.content,
        }))
      );
    if (message) messages.push({ role: "user", content: message });

    // Stream via SSE
    const stream = new ReadableStream<Uint8Array>({
      start: async (controller) => {
        const encoder = new TextEncoder();
        const send = (data: string) =>
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        const sendComment = (comment: string) =>
          controller.enqueue(encoder.encode(`: ${comment}\n\n`));
        try {
          // Minimal keep-alive
          sendComment("stream-start");
          const resp = await client.chat.completions.create({
            model: "gpt-4o-mini",
            stream: true,
            temperature: 0.5,
            presence_penalty: 0.0,
            frequency_penalty: 0.0,
            messages,
          });
          for await (const part of resp) {
            const delta = part.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length) {
              send(delta);
            }
          }
          controller.enqueue(
            encoder.encode(`event: done\n` + `data: [DONE]\n\n`)
          );
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
        // no-op
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
  } catch (err) {
    console.error("API /api/chat error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
