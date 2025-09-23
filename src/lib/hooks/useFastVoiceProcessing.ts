import { useState, useCallback, useRef } from "react";
import { AudioProcessor } from "../audio/AudioProcessor";

interface FastTranscriptionOptions {
  onTranscriptionStart?: () => void;
  onTranscriptionComplete?: (text: string) => void;
  onResponseStart?: () => void;
  onResponseComplete?: (text: string) => void;
  onError?: (error: string) => void;
}

export function useFastVoiceProcessing() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcriptionText, setTranscriptionText] = useState("");
  const [responseText, setResponseText] = useState("");
  const [performance, setPerformance] = useState<{
    transcriptionMs?: number;
    aiResponseMs?: number;
    totalMs?: number;
  }>({});

  const abortControllerRef = useRef<AbortController | null>(null);

  const processVoiceToResponse = useCallback(
    async (
      audioBlob: Blob,
      scenario: string,
      history: any[],
      options: FastTranscriptionOptions = {}
    ) => {
      const {
        onTranscriptionStart,
        onTranscriptionComplete,
        onResponseStart,
        onResponseComplete,
        onError,
      } = options;

      // Cancel any existing processing
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setIsProcessing(true);
      setTranscriptionText("");
      setResponseText("");
      setPerformance({});

      try {
        // Step 1: Optimize audio for faster processing
        onTranscriptionStart?.();
        const optimizedAudio = await AudioProcessor.optimizeForTranscription(
          audioBlob,
          {
            targetSampleRate: 16000,
            maxDurationMs: 30000,
            compressionQuality: 0.4, // Lower quality for speed
          }
        );

        // Step 2: Use the fast voice pipeline
        const formData = new FormData();
        formData.append("audio", optimizedAudio);
        formData.append("scenario", scenario);
        formData.append("history", JSON.stringify(history));

        const response = await fetch("/api/voice-pipeline", {
          method: "POST",
          body: formData,
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`Pipeline failed: ${response.status}`);
        }

        const result = await response.json();

        // Step 3: Progressive UI updates
        if (result.transcription) {
          setTranscriptionText(result.transcription);
          onTranscriptionComplete?.(result.transcription);
        }

        onResponseStart?.();

        if (result.response) {
          // Simulate streaming effect for perceived speed
          let currentText = "";
          const words = result.response.split(" ");

          for (let i = 0; i < words.length; i++) {
            if (abortControllerRef.current?.signal.aborted) break;

            currentText += (i > 0 ? " " : "") + words[i];
            setResponseText(currentText);

            // Small delay for streaming effect
            await new Promise((resolve) => setTimeout(resolve, 20));
          }

          onResponseComplete?.(result.response);
        }

        if (result.performance) {
          setPerformance(result.performance);
          console.log("[FastVoice] Performance:", result.performance);
        }
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("[FastVoice] Processing error:", error);
          onError?.(error.message);
        }
      } finally {
        setIsProcessing(false);
        abortControllerRef.current = null;
      }
    },
    []
  );

  const cancelProcessing = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    processVoiceToResponse,
    cancelProcessing,
    isProcessing,
    transcriptionText,
    responseText,
    performance,
  };
}
