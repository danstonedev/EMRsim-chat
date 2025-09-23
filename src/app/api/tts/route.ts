import { NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const {
      text,
      voice = "alloy",
      format = "mp3",
    } = (await req.json()) as {
      text?: string;
      voice?: string;
      format?: "mp3" | "wav" | "ogg";
    };
    if (!text)
      return NextResponse.json({ error: "No text provided" }, { status: 400 });

    // Use singleton OpenAI client for better performance
    const client = getOpenAIClient();

    // Guard against unsupported voice IDs by falling back to a known-good one
    const supportedVoices = new Set([
      "alloy",
      "echo",
      "fable",
      "onyx",
      "nova",
      "shimmer",
      "coral",
      "verse",
      "ballad",
      "ash",
      "sage",
      "marin",
      "cedar",
    ]);
    const selectedVoice = voice && supportedVoices.has(voice) ? voice : "alloy";

    // Synthesize speech (let the API default to mp3)
    const result = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: selectedVoice,
      input: text,
    });

    // Convert to Buffer and return as audio
    const arrayBuf = await result.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const contentType =
      format === "wav"
        ? "audio/wav"
        : format === "ogg"
        ? "audio/ogg"
        : "audio/mpeg";
    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "X-Voice-Used": selectedVoice,
      },
    });
  } catch (e) {
    // Provide clearer error passthrough for client debugging
    const err = (e ?? {}) as {
      status?: number;
      message?: string;
      response?: { data?: any };
      error?: any;
    };
    const status = typeof err.status === "number" ? err.status : 500;
    const message = err.message || "TTS error";
    const details = err.response?.data ?? err.error;
    console.error("/api/tts error:", message, details || "");
    return NextResponse.json({ error: message, details }, { status });
  }
}
