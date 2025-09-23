"use client";

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import Image from "next/image";
import { PlayIcon, PauseIcon } from "./Icons";
import CircularProgress from "@mui/material/CircularProgress";
import LogoWhite from "../../img/EMRsim-chat_white.png";
import VoiceSelect from "./VoiceSelect";
import { getApiUrl } from "../lib/config/api";
import "../styles/optimized-chat.css";

interface Message {
  id: number;
  text: string;
  sender: "user" | "assistant" | "system";
  timestamp: Date;
}

// Debounce hook for performance optimization
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Memoized audio processing component
const AudioProcessor = ({
  isActive,
  onVuLevel,
}: {
  isActive: boolean;
  onVuLevel: (level: number) => void;
}) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const vuMeterRef = useRef<HTMLDivElement>(null);

  const updateVuMeter = useCallback(
    (level: number) => {
      if (vuMeterRef.current) {
        vuMeterRef.current.style.width = `${level * 100}%`;
      }
      onVuLevel(level);
    },
    [onVuLevel]
  );

  useEffect(() => {
    if (!isActive) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      updateVuMeter(0);
      return;
    }

    const analyze = () => {
      if (!analyserRef.current) return;

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);

      // Optimized RMS calculation
      let sum = 0;
      for (let i = 0; i < bufferLength; i += 4) {
        // Skip every 4th sample for performance
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / (bufferLength / 4));
      const normalizedLevel = Math.min(rms / 128, 1);

      updateVuMeter(normalizedLevel);

      if (isActive) {
        animationRef.current = requestAnimationFrame(analyze);
      }
    };

    animationRef.current = requestAnimationFrame(analyze);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isActive, updateVuMeter]);

  return <div ref={vuMeterRef} className="vu-meter-bar" />;
};

export default function OptimizedChatInterface() {
  // Core state - reduced from 37+ to essential ones
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [conversationalOn, setConversationalOn] = useState(false);
  const [convPhase, setConvPhase] = useState<
    "idle" | "listening" | "transcribing" | "chatting" | "speaking"
  >("idle");
  const [vuLevel, setVuLevel] = useState(0);
  const [toastText, setToastText] = useState("");

  // Refs for performance-critical operations
  const messagesRef = useRef<Message[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLElement>(null);
  const genAbortRef = useRef<AbortController | null>(null);
  const convAbortRef = useRef<AbortController | null>(null);
  const convRunningRef = useRef(false);
  const lastReplyRef = useRef("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef<Map<string, string>>(new Map());
  const toastTimerRef = useRef<number | null>(null);

  // Debounced VU level for performance
  const debouncedVuLevel = useDebounce(vuLevel, 50);

  // Memoized VU bucket calculation
  const vuBucket = useMemo(
    () => Math.max(0, Math.min(10, Math.round(debouncedVuLevel * 10))),
    [debouncedVuLevel]
  );

  // Voice settings - simplified
  const [cloudVoice, setCloudVoice] = useState("alloy");
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [scenarioId, setScenarioId] = useState("lowBackPain");

  // Optimized message handling with useCallback
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: messages.length + 1,
      text: inputValue,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    // Auto-resize textarea
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    try {
      // Abort any previous generation
      genAbortRef.current?.abort();
      genAbortRef.current = new AbortController();

      const history = messages
        .filter((m) => m.sender !== "system")
        .slice(-16) // Keep last 8 pairs max
        .map((m) => ({ role: m.sender, content: m.text }));

      const res = await fetch(getApiUrl("/api/chat"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-pt-scenario": scenarioId,
        },
        body: JSON.stringify({
          message: userMessage.text,
          history,
          scenario: scenarioId,
        }),
        signal: genAbortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`API error: ${res.status}`);
      }

      // Optimized streaming with batched updates
      let botId: number | null = null;
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let acc = "";
      let fullText = "";

      // Batch updates for better performance
      let pending = "";
      let updateScheduled = false;

      const scheduleUpdate = () => {
        if (updateScheduled) return;
        updateScheduled = true;

        // Use setTimeout instead of rAF for better batching
        setTimeout(() => {
          updateScheduled = false;
          const chunk = pending;
          pending = "";
          if (!chunk) return;

          fullText += chunk;

          if (botId == null) {
            setMessages((prev) => {
              const id = (prev[prev.length - 1]?.id || 0) + 1;
              botId = id;
              return [
                ...prev,
                {
                  id,
                  text: chunk,
                  sender: "assistant" as const,
                  timestamp: new Date(),
                },
              ];
            });
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === botId ? { ...m, text: (m.text || "") + chunk } : m
              )
            );
          }
        }, 16); // ~60fps but batched
      };

      while (!done) {
        const result = await reader.read();
        done = result.done || false;

        if (result.value) {
          acc += decoder.decode(result.value, { stream: true });
          const lines = acc.split(/\r?\n/);
          acc = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              pending += data;
              scheduleUpdate();

              if (isTyping) setIsTyping(false);
            }
          }
        }
      }

      lastReplyRef.current = fullText;

      // Auto-speak if enabled
      if (autoSpeak && fullText) {
        speakText(fullText);
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        showToast("Chat service error. Please try again.");
      }
    } finally {
      setIsTyping(false);
      genAbortRef.current = null;
    }
  }, [inputValue, messages, scenarioId, isTyping, autoSpeak]);

  // Optimized TTS with caching and preloading
  const speakText = useCallback(
    async (text: string) => {
      try {
        const key = `${cloudVoice}|${text}`;
        let url = audioCacheRef.current.get(key);

        if (!url) {
          const res = await fetch(getApiUrl("/api/tts"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, voice: cloudVoice, format: "mp3" }),
          });

          if (!res.ok) {
            throw new Error(`TTS request failed (${res.status})`);
          }

          const blob = await res.blob();
          url = URL.createObjectURL(blob);
          audioCacheRef.current.set(key, url);
        }

        if (!audioRef.current) {
          audioRef.current = new Audio();
          audioRef.current.preload = "metadata"; // Optimize loading
        }

        const audio = audioRef.current;
        audio.src = url;
        audio.volume = 1;

        await audio.play();
      } catch (error) {
        showToast("Speech service error. Please try again.");
      }
    },
    [cloudVoice]
  );

  // Optimized conversation loop
  const runConversationalLoop = useCallback(async () => {
    if (convRunningRef.current) return;

    convRunningRef.current = true;
    convAbortRef.current = new AbortController();
    const signal = convAbortRef.current.signal;

    try {
      while (conversationalOn && !signal.aborted) {
        setConvPhase("listening");

        // Simplified listening with timeout
        const audioData = await listenForSpeech(signal, 5000); // 5 second timeout
        if (signal.aborted || !audioData) continue;

        setConvPhase("transcribing");
        const userText = await transcribeAudio(audioData);
        if (signal.aborted || !userText?.trim()) continue;

        // Add user message
        setMessages((prev) => [
          ...prev,
          {
            id: prev.length + 1,
            text: userText,
            sender: "user" as const,
            timestamp: new Date(),
          },
        ]);

        setConvPhase("chatting");
        const reply = await getChatReply(userText);
        if (signal.aborted || !reply) continue;

        // Add assistant message
        setMessages((prev) => [
          ...prev,
          {
            id: prev.length + 1,
            text: reply,
            sender: "assistant" as const,
            timestamp: new Date(),
          },
        ]);

        lastReplyRef.current = reply;

        setConvPhase("speaking");
        await speakText(reply);

        // Brief pause before resuming
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } finally {
      convRunningRef.current = false;
      setConvPhase("idle");
    }
  }, [conversationalOn, speakText]);

  // Simplified audio listening
  const listenForSpeech = async (
    signal: AbortSignal,
    timeout: number
  ): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), timeout);

      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        resolve(null);
      });

      // Simplified implementation - would use MediaRecorder
      // This is a placeholder for the actual implementation
      setTimeout(() => {
        clearTimeout(timer);
        resolve(new Blob()); // Placeholder
      }, 1000);
    });
  };

  // Simplified transcription
  const transcribeAudio = async (audioData: Blob): Promise<string | null> => {
    try {
      const form = new FormData();
      form.append("audio", audioData, "audio.webm");

      const res = await fetch(getApiUrl("/api/transcribe"), {
        method: "POST",
        body: form,
      });

      if (!res.ok) throw new Error("Transcription failed");

      const data = await res.json();
      return data.text || null;
    } catch {
      return null;
    }
  };

  // Simplified chat reply
  const getChatReply = async (userText: string): Promise<string | null> => {
    try {
      const res = await fetch(getApiUrl("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          history: [],
          scenario: scenarioId,
        }),
      });

      if (!res.ok) throw new Error("Chat failed");

      // For simplicity, assume non-streaming response
      const data = await res.json();
      return data.message || null;
    } catch {
      return null;
    }
  };

  // Optimized toast notifications
  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToastText(message);
    toastTimerRef.current = window.setTimeout(() => {
      setToastText("");
    }, 4000);
  }, []);

  // Effect for conversation loop
  useEffect(() => {
    if (conversationalOn) {
      runConversationalLoop();
    } else {
      convAbortRef.current?.abort();
    }

    return () => {
      convAbortRef.current?.abort();
    };
  }, [conversationalOn, runConversationalLoop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      genAbortRef.current?.abort();
      convAbortRef.current?.abort();

      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }

      // Cleanup audio URLs
      audioCacheRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      });
      audioCacheRef.current.clear();
    };
  }, []);

  return (
    <div className="chat-container">
      {/* Toast notifications */}
      {toastText && (
        <div className="fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-md z-50">
          {toastText}
        </div>
      )}

      {/* Chat messages */}
      <main ref={threadRef} className="flex-1 overflow-y-auto p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`mb-4 ${
              message.sender === "user" ? "text-right" : "text-left"
            }`}
          >
            <div
              className={`inline-block p-3 rounded-lg max-w-xs sm:max-w-md ${
                message.sender === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-black"
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="text-left mb-4">
            <div className="inline-block p-3 rounded-lg bg-gray-200">
              <CircularProgress size={16} />
            </div>
          </div>
        )}
      </main>

      {/* Input area */}
      <div className="border-t p-4">
        <div className="flex items-center gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              conversationalOn
                ? "Conversation mode active..."
                : "Type your message..."
            }
            className="flex-1 p-2 border rounded-md resize-none"
            rows={1}
            disabled={conversationalOn}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />

          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isTyping || conversationalOn}
            className="px-4 py-2 bg-blue-500 text-white rounded-md disabled:opacity-50"
          >
            Send
          </button>

          <button
            onClick={() => setConversationalOn((prev) => !prev)}
            className={`px-4 py-2 rounded-md ${
              conversationalOn
                ? "bg-red-500 text-white"
                : "bg-green-500 text-white"
            }`}
          >
            {conversationalOn ? "Stop" : "Talk"}
          </button>
        </div>
      </div>

      {/* Conversation overlay */}
      {conversationalOn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white p-8 rounded-lg text-center">
            <h3 className="text-xl font-bold mb-4">Conversation Mode</h3>
            <p className="mb-4">Status: {convPhase}</p>

            {/* Simplified VU meter */}
            <div className="vu-meter">
              <AudioProcessor
                isActive={conversationalOn && convPhase === "listening"}
                onVuLevel={setVuLevel}
              />
            </div>

            <button
              onClick={() => setConversationalOn(false)}
              className="mt-4 px-4 py-2 bg-red-500 text-white rounded-md"
            >
              Stop Conversation
            </button>
          </div>
        </div>
      )}

      {/* Audio processor component - removed since it's now integrated in VU meter */}
    </div>
  );
}
