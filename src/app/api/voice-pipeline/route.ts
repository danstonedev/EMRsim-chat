import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai/client";
import {
  resolvePersonaPromptByScenarioId,
  isAllowedScenario,
} from "@/lib/prompts/allowlist";
import { SAFETY_WRAPPER_PROMPT } from "@/lib/prompts/safety";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json(
        {
          error: 'Content-Type must be multipart/form-data with field "audio"',
        },
        { status: 400 }
      );
    }

    const startTotal = Date.now();
    const form = await req.formData();
    const audio = form.get("audio") as File | null;
    const scenario = (form.get("scenario") as string) || undefined;
    let history: Array<{ role: "user" | "assistant"; content: string }> = [];
    try {
      const raw = form.get("history") as string | null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          history = parsed.filter(
            (m) =>
              m &&
              typeof m.content === "string" &&
              (m.role === "user" || m.role === "assistant")
          );
        }
      }
    } catch {}

    if (!audio) {
      return NextResponse.json(
        { error: 'Missing audio file in field "audio"' },
        { status: 400 }
      );
    }

    const client = getOpenAIClient();

    // 1) Transcribe
    const startTrans = Date.now();
    // Accept optional language hints; when not provided or set to 'auto', let the model auto-detect
    const langRaw = (form.get("language") as string | null) || (form.get("input_language") as string | null) || null;
    const language = langRaw && langRaw.toLowerCase() !== 'auto' ? langRaw : undefined;
    const transcribeParams: any = {
      model: "whisper-1",
      file: await fileFromBlob(audio),
      response_format: "text",
      temperature: 0,
    };
    if (language) transcribeParams.language = language;

    const transcriptionText = await client.audio.transcriptions
  .create(transcribeParams)
  .then((t: any) => (typeof t === "string" ? t.trim() : String(t).trim()));
    const transcriptionMs = Date.now() - startTrans;

    // 2) Chat response (only if we have some text)
    let responseText = "";
    let aiMs = 0;
    if (transcriptionText) {
      const personaPrompt = resolvePersonaPromptByScenarioId(
        isAllowedScenario(scenario || "") ? scenario : undefined
      );
      const messages: {
        role: "system" | "user" | "assistant";
        content: string;
      }[] = [];
      messages.push({ role: "system", content: SAFETY_WRAPPER_PROMPT });
      messages.push({ role: "system", content: personaPrompt });
      if (history.length) messages.push(...history);
      messages.push({ role: "user", content: transcriptionText });

      const startAi = Date.now();
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.5,
        presence_penalty: 0.0,
        frequency_penalty: 0.0,
        messages,
      });
      responseText = completion.choices?.[0]?.message?.content?.trim?.() || "";
      aiMs = Date.now() - startAi;
    }

    const totalMs = Date.now() - startTotal;

    return NextResponse.json({
      transcription: transcriptionText,
      response: responseText,
      performance: {
        transcriptionMs,
        aiResponseMs: aiMs,
        totalMs,
      },
    });
  } catch (e) {
    const err = e as any;
    console.error("/api/voice-pipeline error:", err?.message || err);
    return NextResponse.json(
      { error: "voice_pipeline_error" },
      { status: 500 }
    );
  }
}

async function fileFromBlob(blob: Blob): Promise<File> {
  const buffer = Buffer.from(await blob.arrayBuffer());
  return new File([buffer], "audio.webm", { type: blob.type || "audio/webm" });
}
