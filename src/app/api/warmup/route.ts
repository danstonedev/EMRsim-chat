import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai/client";
import { buildPatientSystemPrompt } from "@/lib/prompts/patient";
import { CASES, PTCaseId } from "@/lib/prompts/ptCases";

/**
 * Warm-up API endpoint to pre-initialize OpenAI client
 * This runs a lightweight prompt verification request in the background
 * to eliminate cold start delays for the first user interaction
 */
export async function POST(request: NextRequest) {
  try {
    const client = getOpenAIClient();

    // Check if a specific scenario should be pre-warmed
    const body = await request.json().catch(() => ({}));
    const scenario = body.scenario as PTCaseId | undefined;

    let systemPrompt =
      'You are a medical simulation assistant. Respond with just "Ready" if you understand your role.';
    let userPrompt = "Are you ready to simulate patient interactions?";

    // If a scenario is specified, warm up with that specific context
    if (scenario && CASES[scenario]) {
      systemPrompt = buildPatientSystemPrompt(CASES[scenario]);
      userPrompt =
        'Please confirm you understand your role as this patient. Respond with just "Ready" followed by your character\'s first name.';
    }

    // Lightweight warm-up request - just verify the client can connect
    const warmupResponse = await client.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      max_tokens: 15, // Keep it minimal for speed
      temperature: 0.1, // Consistent responses
    });

    const response = warmupResponse.choices[0]?.message?.content?.trim() || "";

    return NextResponse.json({
      status: "warmed-up",
      ready: response.toLowerCase().includes("ready"),
      scenario: scenario || "general",
      response: response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Warmup request failed:", error);
    // Don't fail the warmup - just log and continue
    return NextResponse.json({
      status: "warmup-failed",
      ready: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
}
