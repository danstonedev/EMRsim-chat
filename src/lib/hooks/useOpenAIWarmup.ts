import { useEffect, useRef } from "react";
import { PTCaseId } from "../prompts/ptCases";

interface WarmupResult {
  status: "warmed-up" | "warmup-failed";
  ready: boolean;
  scenario: string;
  response?: string;
  timestamp: string;
  error?: string;
}

interface UseOpenAIWarmupOptions {
  scenario?: PTCaseId;
}

/**
 * Hook to warm up the OpenAI client in the background
 * Triggers a lightweight API request when the app loads to eliminate cold start delays
 * Can optionally pre-warm with a specific scenario context
 */
export function useOpenAIWarmup(options: UseOpenAIWarmupOptions = {}) {
  const warmupAttempted = useRef(false);
  const warmupResult = useRef<WarmupResult | null>(null);
  const { scenario } = options;

  useEffect(() => {
    // Only attempt warmup once per session
    if (warmupAttempted.current) return;
    warmupAttempted.current = true;

    // Trigger warmup request in the background
    const warmupOpenAI = async () => {
      try {
        const requestBody = scenario ? { scenario } : {};

        const response = await fetch("/api/warmup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (response.ok) {
          const result: WarmupResult = await response.json();
          warmupResult.current = result;

          if (result.ready) {
            console.log(
              `✅ OpenAI client warmed up successfully${
                scenario ? ` for ${scenario}` : ""
              }`
            );
            if (result.response && result.response !== "Ready") {
              console.log(`🎭 Character confirmed: ${result.response}`);
            }
          } else {
            console.warn("⚠️ OpenAI warmup completed but not ready");
          }
        } else {
          console.warn("⚠️ OpenAI warmup request failed:", response.status);
        }
      } catch (error) {
        console.warn("⚠️ OpenAI warmup error:", error);
      }
    };

    // Start warmup after a brief delay to not block initial render
    const timeoutId = setTimeout(warmupOpenAI, 500);

    return () => clearTimeout(timeoutId);
  }, [scenario]);

  return {
    isWarmedUp: warmupResult.current?.ready || false,
    warmupStatus: warmupResult.current?.status || null,
    warmupResponse: warmupResult.current?.response,
  };
}
