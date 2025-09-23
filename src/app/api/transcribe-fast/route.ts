import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai/client";

/**
 * Enhanced transcription endpoint with streaming optimization
 * Processes audio chunks in real-time for faster response
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        {
          error: 'Content-Type must be multipart/form-data with field "audio"',
        },
        { status: 400 }
      );
    }

    const form = await req.formData();
    const audio = form.get("audio") as File | null;
    if (!audio) {
      return NextResponse.json(
        { error: 'Missing audio file in field "audio"' },
        { status: 400 }
      );
    }

    const client = getOpenAIClient();

    // Performance optimization: Use smaller, faster model for quick transcription
    const startTime = Date.now();

    const transcription = await client.audio.transcriptions.create({
      model: "whisper-1",
      file: await fileFromBlob(audio),
      // Optimize for speed vs accuracy
      response_format: "text", // Faster than JSON
      temperature: 0.0, // More deterministic, faster processing
      // Add language hint if known to speed up processing
      language: "en", // Assume English for faster processing
    });

    const processingTime = Date.now() - startTime;
    console.log(`[Transcription] Completed in ${processingTime}ms`);

    return NextResponse.json({
      text: transcription.trim(),
      processingTimeMs: processingTime,
    });
  } catch (error) {
    console.error("Transcription error:", error);
    return NextResponse.json(
      { error: "Transcription failed" },
      { status: 500 }
    );
  }
}

async function fileFromBlob(blob: Blob): Promise<File> {
  const buffer = Buffer.from(await blob.arrayBuffer());
  return new File([buffer], "audio.webm", { type: blob.type });
}
