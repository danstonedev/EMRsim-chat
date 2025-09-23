"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { PlayIcon, PauseIcon } from "./Icons";
import CircularProgress from "@mui/material/CircularProgress";
import LogoWhite from "../../img/EMRsim-chat_white.png";
import VoiceSelect from "./VoiceSelect";
import { getApiUrl } from "../lib/config/api";
import { useOpenAIWarmup } from "../lib/hooks/useOpenAIWarmup";
import { useFastVoiceProcessing } from "../lib/hooks/useFastVoiceProcessing";
import { usePerformanceMonitor } from "../lib/performance/PerformanceMonitor";
import { OptimizationTracker } from "../lib/performance/OptimizationTracker";
import { PTCaseId } from "../lib/prompts/ptCases";

interface Message {
  id: number;
  text: string;
  sender: "user" | "assistant" | "system";
  timestamp: Date;
}

export default function ChatInterface() {
  // Supported OpenAI TTS voices (per API error list)
  const SUPPORTED_CLOUD_VOICES = [
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
  ] as const;
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  // System prompt is now controlled on the server (patient persona); no client-side prompt.
  // Theme state - initialize from DOM (set pre-paint in layout) to avoid flash/mismatch
  const [theme, setTheme] = useState<string>(() => {
    if (typeof document !== "undefined") {
      const fromDom = document.documentElement.getAttribute("data-theme");
      if (fromDom === "dark" || fromDom === "light") return fromDom;
      // Fallback to system preference if DOM not set (should be rare)
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      )
        return "dark";
    }
    return "light";
  });
  const [isHydrated, setIsHydrated] = useState(false);
  const hydratedRef = useRef(false);
  // SSR-stable default; load preference after mount to avoid hydration mismatch
  const [controlsOpen, setControlsOpen] = useState<boolean>(true);
  const threadRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const lastReplyRef = useRef<string>("");
  // Mic status indicator
  const [micStatus, setMicStatus] = useState<"idle" | "listening" | "stopped">(
    "idle"
  );
  const micStatusTimerRef = useRef<number | null>(null);
  // TTS controls
  // SSR-stable defaults; load preferences after mount
  const [cloudVoice, setCloudVoice] = useState<string>("alloy");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastAudioUrlRef = useRef<string>("");
  const audioCacheRef = useRef<Map<string, string>>(new Map());
  const [loadingByMessage, setLoadingByMessage] = useState<
    Record<number, boolean>
  >({});
  const [ttsErrorByMessage, setTtsErrorByMessage] = useState<
    Record<number, string | undefined>
  >({});
  const [currentTtsKey, setCurrentTtsKey] = useState<string>("");
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const audioEventsBoundRef = useRef<boolean>(false);
  // Audio fading helpers
  const defaultVolumeRef = useRef<number>(1);
  const fadeCancelRef = useRef<(() => void) | null>(null);
  // Abort controller for in-flight assistant generation (streaming)
  const genAbortRef = useRef<AbortController | null>(null);

  const fadeTo = (targetVolume: number, duration = 180): Promise<void> => {
    return new Promise((resolve) => {
      const audio = audioRef.current;
      if (!audio) return resolve();
      // Cancel any ongoing fade
      if (fadeCancelRef.current) {
        try {
          fadeCancelRef.current();
        } catch {}
        fadeCancelRef.current = null;
      }
      const start = performance.now();
      const startVol = audio.volume;
      const clamp = (v: number) => Math.max(0, Math.min(1, v));
      if (duration <= 0) {
        audio.volume = clamp(targetVolume);
        return resolve();
      }
      let rafId = 0;
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const v = startVol + (targetVolume - startVol) * t;
        audio.volume = clamp(v);
        if (t < 1) {
          rafId = requestAnimationFrame(step);
        } else {
          fadeCancelRef.current = null;
          resolve();
        }
      };
      fadeCancelRef.current = () => {
        cancelAnimationFrame(rafId);
        fadeCancelRef.current = null;
        resolve();
      };
      rafId = requestAnimationFrame(step);
    });
  };
  const fadeOut = (duration = 160) => fadeTo(0, duration);
  const fadeIn = (duration = 180) => fadeTo(defaultVolumeRef.current, duration);

  // PT Case Scenario selection
  const SCENARIOS = [
    { id: "lowBackPain", label: "Low Back Pain" },
    { id: "aclRehab", label: "ACL Rehab (6 weeks)" },
    { id: "rotatorCuff", label: "Rotator Cuff Pain" },
    { id: "strokeGait", label: "Post‑Stroke Gait" },
    { id: "ankleSprain", label: "Ankle Sprain" },
  ] as const;
  const [scenarioId, setScenarioId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const v = window.localStorage.getItem("chat-pt-scenario");
        if (v) return v;
      } catch {}
    }
    return "lowBackPain";
  });

  // OpenAI warmup to eliminate cold start delays
  const { isWarmedUp, warmupStatus } = useOpenAIWarmup({
    scenario: scenarioId as PTCaseId,
  });

  // Fast voice processing pipeline for ultra-speed optimization
  const {
    processVoiceToResponse,
    isProcessing: isFastProcessing,
    transcriptionText,
    responseText,
    performance: voicePerformance,
    cancelProcessing,
  } = useFastVoiceProcessing();

  // Performance monitoring for Core Web Vitals and voice metrics
  const { trackVoicePerformance, generateReport } = usePerformanceMonitor();

  // Optimization outcome tracking
  const {
    trackInteraction,
    trackError,
    generateOptimizationReport,
    metrics: optimizationMetrics,
  } = OptimizationTracker();

  // Make optimization tracking available globally for console debugging
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.getOptimizationReport = generateOptimizationReport;
      window.trackVoiceProcessing = (metrics: any) => {
        const isFirstInteraction = optimizationMetrics.totalInteractions === 0;
        const totalTime = metrics.totalMs || metrics.totalProcessingTime || 0;
        if (totalTime > 0) {
          trackInteraction(
            isFirstInteraction ? "first" : "subsequent",
            totalTime
          );
        }
      };

      // Add keyboard shortcut for performance report (Ctrl+Shift+P)
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.ctrlKey && event.shiftKey && event.key === "P") {
          event.preventDefault();
          const report = generateOptimizationReport();
          console.log(report);
          alert(report); // Also show in alert for visibility
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        delete window.getOptimizationReport;
        delete window.trackVoiceProcessing;
      };
    }
  }, [
    generateOptimizationReport,
    trackInteraction,
    optimizationMetrics.totalInteractions,
  ]);

  // Conversational mode (hands-free) state
  const [conversationalOn, setConversationalOn] = useState<boolean>(false);
  const convAbortRef = useRef<AbortController | null>(null);
  const convPhaseRef = useRef<
    "idle" | "listening" | "transcribing" | "chatting" | "speaking"
  >("idle");
  const convRunningRef = useRef<boolean>(false);
  // UI reflections of conversation state
  const [convPhase, setConvPhase] = useState<
    "idle" | "listening" | "transcribing" | "chatting" | "speaking"
  >("idle");
  const [vuLevel, setVuLevel] = useState<number>(0); // 0..1 live mic level for visualizer
  const [vuBucket, setVuBucket] = useState<number>(0); // 0..10 discrete bucket for CSS classes
  // Audio output analysis for speaking indicator
  const [audioVuLevel, setAudioVuLevel] = useState<number>(0); // 0..1 live audio output level
  const [audioVuBucket, setAudioVuBucket] = useState<number>(0); // 0..10 discrete bucket for CSS classes
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioAnimationRef = useRef<number | null>(null);
  // Conversation overlay ref for direct CSS property manipulation
  const convOverlayRef = useRef<HTMLDivElement | null>(null);
  // Mic devices and selection
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string>("");
  const [convError, setConvError] = useState<string>("");
  // Toast banner for non-blocking API errors
  const [toastText, setToastText] = useState<string>("");
  const toastTimerRef = useRef<number | null>(null);

  const refreshInputDevices = async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devs = await navigator.mediaDevices.enumerateDevices();
      const inputs = devs.filter((d) => d.kind === "audioinput");
      setInputDevices(inputs);
      // Prefer previously selected mic if available
      let desired = selectedInputId;
      if (!desired) {
        try {
          desired = window.localStorage.getItem("chat-mic-device-id") || "";
        } catch {}
      }
      if (desired && inputs.some((d) => d.deviceId === desired)) {
        if (desired !== selectedInputId) setSelectedInputId(desired);
      } else if (inputs.length > 0 && !selectedInputId) {
        setSelectedInputId(inputs[0].deviceId || "");
      }
    } catch (e) {
      // ignore; will be retried after permission
    }
  };

  const ensureMicAccess = async (): Promise<boolean> => {
    try {
      // Request minimal audio to unlock device labels and permissions
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch {}
      await refreshInputDevices();
      setConvError("");
      return true;
    } catch (e: any) {
      let msg = "Microphone access was blocked.";
      if (e?.name === "NotAllowedError")
        msg =
          "Microphone permission denied. Please allow mic access in your browser.";
      else if (e?.name === "NotFoundError")
        msg = "No microphone detected. Please connect a microphone.";
      else if (e?.name === "NotReadableError")
        msg = "Microphone is in use by another application.";
      setConvError(msg);
      return false;
    }
  };

  const handleSendMessage = async () => {
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

    // Auto-resize textarea back to single line
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    const buildBoundedHistory = (
      all: Message[],
      maxPairs: number
    ): Array<{ role: "user" | "assistant"; content: string }> => {
      const ua = all.filter((m) => m.sender !== "system");
      // Keep last N user/assistant messages (roughly pairs)
      const maxMsgs = Math.max(2, maxPairs * 2);
      const slice = ua.slice(Math.max(0, ua.length - maxMsgs));
      return slice.map((m) => ({ role: m.sender, content: m.text })) as Array<{
        role: "user" | "assistant";
        content: string;
      }>;
    };

    try {
      const history = buildBoundedHistory(messages, 8);

      // Abort any previous generation and start a new controller
      try {
        genAbortRef.current?.abort();
      } catch {}
      genAbortRef.current = new AbortController();

      const res = await fetch(getApiUrl("/api/chat-optimized"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-pt-scenario": scenarioId,
          "x-warmed-up": isWarmedUp ? "true" : "false", // Signal warmup status
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

      // We'll create the assistant message only when the first chunk arrives to avoid an empty placeholder bubble
      let botId: number | null = null;

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let acc = "";
      let fullText = "";
      let firstChunkSeen = false;

      // rAF-batched commit to reduce reflow thrash
      let pending = "";
      let rafScheduled = false;
      const scheduleCommit = () => {
        if (rafScheduled) return;
        rafScheduled = true;
        requestAnimationFrame(() => {
          rafScheduled = false;
          const chunk = pending;
          pending = "";
          if (!chunk) return;
          fullText += chunk;
          // Create the assistant message on first commit, otherwise append to it
          if (botId == null) {
            setMessages((prev) => {
              const id = (prev[prev.length - 1]?.id || 0) + 1;
              botId = id;
              const next: Message = {
                id,
                text: chunk,
                sender: "assistant",
                timestamp: new Date(),
              };
              return [...prev, next];
            });
          } else {
            const id = botId;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === id ? { ...m, text: (m.text || "") + chunk } : m
              )
            );
          }
        });
      };
      const enqueueChunk = (t: string) => {
        if (!t) return;
        pending += t;
        scheduleCommit();
      };

      while (!done) {
        const r = await reader.read();
        done = r.done || false;
        if (r.value) {
          acc += decoder.decode(r.value, { stream: true });
          // Parse SSE lines
          const lines = acc.split(/\r?\n/);
          // Keep last partial line in acc
          acc = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              // On first chunk, hide the typing indicator and Stop button for a cleaner UI
              if (!firstChunkSeen) {
                firstChunkSeen = true;
                try {
                  setIsTyping(false);
                } catch {}
              }
              // We stream raw token text; not JSON. Append via rAF batching.
              enqueueChunk(data);
            }
          }
        }
      }

      lastReplyRef.current = fullText;
      if (autoSpeak && fullText) playMessage(fullText, botId ?? undefined);
    } catch (error: any) {
      if (error?.name === "AbortError") {
        // Swallow aborts (user-initiated stop)
        return;
      }
      // Show a small toast instead of polluting transcript
      try {
        if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      } catch {}
      setToastText("Chat service error. Please try again.");
      toastTimerRef.current = window.setTimeout(() => setToastText(""), 4000);
    } finally {
      setIsTyping(false);
      genAbortRef.current = null;
    }
  };

  // Text-to-speech
  const speakText = async (text: string) => {
    try {
      // Cloud TTS via API
      const safeVoice = SUPPORTED_CLOUD_VOICES.includes(cloudVoice as any)
        ? cloudVoice
        : "alloy";
      const key = `${safeVoice}|${text}`;
      let url = audioCacheRef.current.get(key);
      if (!url) {
        const res = await fetch(getApiUrl("/api/tts"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: safeVoice, format: "mp3" }),
        });
        if (!res.ok) {
          let msg = `TTS request failed (${res.status})`;
          try {
            const j = await res.json();
            if (j?.error) msg += `: ${j.error}`;
          } catch {}
          console.error(msg);
          // Toast: service error
          try {
            if (toastTimerRef.current)
              window.clearTimeout(toastTimerRef.current);
          } catch {}
          setToastText("Speech service error. Please try again.");
          toastTimerRef.current = window.setTimeout(
            () => setToastText(""),
            4000
          );
          throw new Error("TTS request failed");
        }
        const blob = await res.blob();
        url = URL.createObjectURL(blob);
        audioCacheRef.current.set(key, url);
      }
      if (!audioRef.current) audioRef.current = new Audio();
      if (!audioEventsBoundRef.current && audioRef.current) {
        audioRef.current.addEventListener("play", () => {
          setIsSpeaking(true);
          setupAudioAnalysis();
          startAudioAnalysis();
        });
        audioRef.current.addEventListener("pause", () => {
          setIsSpeaking(false);
          stopAudioAnalysis();
        });
        audioRef.current.addEventListener("ended", () => {
          setIsSpeaking(false);
          stopAudioAnalysis();
        });
        audioEventsBoundRef.current = true;
      }
      try {
        if (lastAudioUrlRef.current)
          URL.revokeObjectURL(lastAudioUrlRef.current);
      } catch {}
      lastAudioUrlRef.current = url;
      const audio = audioRef.current;
      // Cross-fade if previously playing
      if (!audio.paused) {
        try {
          await fadeOut(140);
          audio.pause();
        } catch {}
      }
      try {
        audio.currentTime = 0;
      } catch {}
      audio.src = url;
      try {
        audio.volume = 0;
      } catch {}
      setCurrentTtsKey(`cloud|${safeVoice}|${text}`);
      await audio.play();
      try {
        await fadeIn(200);
      } catch {}
      return;
    } catch {
      // Toast: network or playback error
      try {
        if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      } catch {}
      setToastText("Network error talking to speech service.");
      toastTimerRef.current = window.setTimeout(() => setToastText(""), 4000);
    }
  };

  // Playback controls
  const startSpeaking = async () => {
    const text = lastReplyRef.current;
    if (!text) return;
    // If audio exists, resume/play; otherwise fetch via speakText
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    if (!audio.src) {
      await speakText(text);
      return;
    }
    try {
      await audio.play();
    } catch {
      await speakText(text);
    }
  };

  const pauseSpeaking = async () => {
    const audio = audioRef.current;
    if (audio) {
      try {
        await fadeOut(120);
        audio.pause();
      } catch {
        try {
          audio.pause();
        } catch {}
      }
    }
  };

  const stopSpeaking = async () => {
    const audio = audioRef.current;
    if (audio) {
      try {
        await fadeOut(140);
        audio.pause();
        audio.currentTime = 0;
        audio.volume = defaultVolumeRef.current;
      } catch {
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch {}
      }
    }
  };

  const restartSpeaking = async () => {
    const text = lastReplyRef.current;
    if (!text) return;
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    if (audio.src) {
      try {
        audio.pause();
        audio.currentTime = 0;
        await audio.play();
        return;
      } catch {}
    }
    await speakText(text);
  };

  // Play a specific message text with optional loading indicator
  const playMessage = async (text: string, messageId?: number) => {
    const safeVoice = SUPPORTED_CLOUD_VOICES.includes(cloudVoice as any)
      ? cloudVoice
      : "alloy";
    const key = `${safeVoice}|${text}`;
    let url = audioCacheRef.current.get(key);
    const needsFetch = !url;
    if (needsFetch && messageId)
      setLoadingByMessage((prev) => ({ ...prev, [messageId]: true }));
    if (messageId)
      setTtsErrorByMessage((prev) => ({ ...prev, [messageId]: undefined }));
    try {
      if (!url) {
        const res = await fetch(getApiUrl("/api/tts"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: safeVoice, format: "mp3" }),
        });
        if (!res.ok) {
          let msg = `TTS request failed (${res.status})`;
          try {
            const j = await res.json();
            if (j?.error) msg += `: ${j.error}`;
          } catch {}
          console.error(msg);
          if (messageId)
            setTtsErrorByMessage((prev) => ({ ...prev, [messageId]: msg }));
          // Toast: service error
          try {
            if (toastTimerRef.current)
              window.clearTimeout(toastTimerRef.current);
          } catch {}
          setToastText("Speech service error. Please try again.");
          toastTimerRef.current = window.setTimeout(
            () => setToastText(""),
            4000
          );
          throw new Error("TTS request failed");
        }
        const blob = await res.blob();
        url = URL.createObjectURL(blob);
        audioCacheRef.current.set(key, url);
      }
      if (!audioRef.current) audioRef.current = new Audio();
      if (!audioEventsBoundRef.current && audioRef.current) {
        audioRef.current.addEventListener("play", () => {
          setIsSpeaking(true);
          setupAudioAnalysis();
          startAudioAnalysis();
        });
        audioRef.current.addEventListener("pause", () => {
          setIsSpeaking(false);
          stopAudioAnalysis();
        });
        audioRef.current.addEventListener("ended", () => {
          setIsSpeaking(false);
          stopAudioAnalysis();
        });
        audioEventsBoundRef.current = true;
      }
      const audio = audioRef.current;
      if (!audio.paused) {
        try {
          await fadeOut(140);
          audio.pause();
        } catch {}
      }
      try {
        audio.currentTime = 0;
      } catch {}
      audio.src = url as string;
      try {
        audio.volume = 0;
      } catch {}
      setCurrentTtsKey(`cloud|${safeVoice}|${text}`);
      await audio.play();
      try {
        await fadeIn(200);
      } catch {}
      if (messageId)
        setTtsErrorByMessage((prev) => ({ ...prev, [messageId]: undefined }));
    } catch (e) {
      // Prevent unhandled promise rejection and surface detail to console
      console.error("playMessage error:", e);
      // Toast: generic playback/network error
      try {
        if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      } catch {}
      setToastText("Could not play speech audio.");
      toastTimerRef.current = window.setTimeout(() => setToastText(""), 4000);
    } finally {
      if (messageId)
        setLoadingByMessage((prev) => ({ ...prev, [messageId]: false }));
    }
  };

  const restartSpeakingForText = async (text: string, messageId?: number) => {
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    if (audio.src) {
      try {
        await fadeOut(140);
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 0;
        await audio.play();
        await fadeIn(200);
        return;
      } catch {}
    }
    await playMessage(text, messageId);
  };

  // Toggle play/pause for a specific message; resume if already loaded and paused
  const togglePlayPauseForText = async (text: string, messageId?: number) => {
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    const safeVoice = SUPPORTED_CLOUD_VOICES.includes(cloudVoice as any)
      ? cloudVoice
      : "alloy";
    const thisKey = `cloud|${safeVoice}|${text}`;

    // If this message is currently playing, pause
    if (!audio.paused && currentTtsKey === thisKey) {
      try {
        await fadeOut(120);
        audio.pause();
        return;
      } catch {
        try {
          audio.pause();
          return;
        } catch {}
      }
    }
    // If this message is loaded but paused, resume
    if (audio.paused && currentTtsKey === thisKey && audio.src) {
      try {
        audio.volume = 0;
        await audio.play();
        await fadeIn(200);
        return;
      } catch {}
    }
    // Otherwise play (fetch if needed)
    await playMessage(text, messageId);
  };

  // --- Audio Analysis for Speaking VU Meter ---
  const setupAudioAnalysis = () => {
    if (!audioRef.current || audioContextRef.current) return;

    try {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaElementSource(audioRef.current);

      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.85;
      source.connect(analyser);
      analyser.connect(audioContext.destination);

      audioContextRef.current = audioContext;
      audioAnalyserRef.current = analyser;
      audioSourceRef.current = source;

      startAudioAnalysis();
    } catch (error) {
      console.warn("Could not setup audio analysis:", error);
    }
  };

  const startAudioAnalysis = () => {
    if (!audioAnalyserRef.current || audioAnimationRef.current) return;

    const analyser = audioAnalyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const analyze = () => {
      analyser.getByteFrequencyData(dataArray);

      // Calculate overall RMS for VU level
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / bufferLength);
      const normalizedLevel = Math.min(rms / 128, 1); // Normalize to 0-1

      setAudioVuLevel(normalizedLevel);

      // Update bucket for discrete CSS classes (0-10)
      const b = Math.max(0, Math.min(10, Math.round(normalizedLevel * 10)));
      setAudioVuBucket((prev) => (prev !== b ? b : prev));

      if (isSpeaking) {
        audioAnimationRef.current = requestAnimationFrame(analyze);
      }
    };

    audioAnimationRef.current = requestAnimationFrame(analyze);
  };

  const stopAudioAnalysis = () => {
    if (audioAnimationRef.current) {
      cancelAnimationFrame(audioAnimationRef.current);
      audioAnimationRef.current = null;
    }
    setAudioVuLevel(0);
    setAudioVuBucket(0);
  };

  // --- Conversational Mode Helpers ---
  // Simple energy-based VAD using Web Audio API
  const listenOnceWithVAD = async (
    abortSignal: AbortSignal
  ): Promise<Blob | null> => {
    // Constraints: enable echo cancellation/noise suppression to reduce feedback
    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: selectedInputId
          ? ({ exact: selectedInputId } as any)
          : undefined,
        echoCancellation: true as any,
        noiseSuppression: true as any,
        autoGainControl: true as any,
      },
      video: false,
    };
    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let src: MediaStreamAudioSourceNode | null = null;
    let rafId: number | null = null;
    let intervalId: number | null = null;

    const cleanup = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (intervalId !== null) clearInterval(intervalId);
      try {
        mediaRecorderRef.current?.state === "recording" &&
          mediaRecorderRef.current?.stop();
      } catch {}
      try {
        stream?.getTracks().forEach((t) => t.stop());
      } catch {}
      try {
        audioCtx?.close();
      } catch {}
      analyser = null;
      src = null;
      audioCtx = null;
      stream = null;
    };

    // Baseline and VAD thresholds (dynamic calibration)
    const BASE_START_MIN = 0.02; // minimal start threshold floor
    const BASE_STOP_MIN = 0.012; // minimal stop threshold floor
    const SILENCE_MS = 800; // duration of silence to end utterance
    const MAX_UTTERANCE_MS = 15000;
    const MAX_WAIT_FOR_SPEECH_MS = 5000;
    const MIN_START_CONSEC_FRAMES = 3; // ~150ms (with 50ms frame)
    const MIN_VOICED_FRAMES = 6; // ~300ms voiced content required
    const MIN_UTTER_MS = 400; // total utterance length required
    const MIN_VOICED_RATIO = 0.2; // proportion of voiced frames during utterance

    try {
      setMicStatus("listening");
      stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Setup recorder
      if (typeof MediaRecorder === "undefined") {
        throw new Error("MediaRecorder is not supported in this browser");
      }
      let mime = "audio/webm";
      try {
        if (
          (MediaRecorder as any).isTypeSupported &&
          !(MediaRecorder as any).isTypeSupported(mime)
        )
          mime = "";
      } catch {}
      const mr = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined
      );
      mediaRecorderRef.current = mr;
      mediaChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) mediaChunksRef.current.push(e.data);
      };

      // Setup analysis
      audioCtx = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      src = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);

      let speaking = false;
      let lastLoudTs = 0;
      let startTs = performance.now();
      let speechStartTs: number | null = null;
      let speechEndTs: number | null = null;

      // allocate buffer once; computeRMS defined below during calibration
      let timeData: Uint8Array & { buffer: ArrayBuffer };
      let computeRMS: () => number;

      // Start recording immediately to capture leading audio
      mr.start();
      setIsRecording(true);

      // Calibrate baseline noise for a short window
      timeData = new Uint8Array(analyser.fftSize) as any;

      computeRMS = () => {
        analyser!.getByteTimeDomainData(
          timeData as unknown as Uint8Array<ArrayBuffer>
        );
        let sum = 0;
        for (let i = 0; i < timeData.length; i++) {
          const v = (timeData[i] - 128) / 128;
          sum += v * v;
        }
        return Math.sqrt(sum / timeData.length);
      };

      const calibSamples: number[] = [];
      const calibStart = performance.now();
      while (performance.now() - calibStart < 400) {
        calibSamples.push(computeRMS());
        await new Promise((r) => setTimeout(r, 25));
        if (abortSignal.aborted) {
          cleanup();
          return null;
        }
      }
      const mean =
        calibSamples.reduce((a, b) => a + b, 0) /
        Math.max(1, calibSamples.length);
      const variance =
        calibSamples.reduce((a, b) => a + (b - mean) * (b - mean), 0) /
        Math.max(1, calibSamples.length);
      const std = Math.sqrt(Math.max(variance, 0));
      const START_THRESHOLD = Math.max(mean + 3 * std, BASE_START_MIN);
      const STOP_THRESHOLD = Math.max(mean + 1.5 * std, BASE_STOP_MIN);

      // Simple linear mapping of RMS to 0..1 for UI visualizer
      const mapVu = (rms: number) => {
        // Normalize between noise floor and speech threshold
        const denom = Math.max(START_THRESHOLD - mean, 0.0001);
        const norm = (rms - mean) / denom;
        const clamped = Math.max(0, Math.min(1, norm));
        setVuLevel((prev) =>
          Math.abs(clamped - prev) > 0.02 ? clamped : prev
        );
        const b = Math.max(0, Math.min(10, Math.round(clamped * 10)));
        setVuBucket((prev) => (prev !== b ? b : prev));
      };

      // Monitor in short intervals (faster than requestAnimationFrame for consistent timing)
      let consecAbove = 0;
      let voicedFrames = 0;
      let totalFrames = 0;
      let validUtterance = false;

      intervalId = window.setInterval(() => {
        if (abortSignal.aborted) {
          cleanup();
          return;
        }
        const rms = computeRMS();
        // Update visual meter regardless of phase during listening window
        try {
          mapVu(rms);
        } catch {}
        const now = performance.now();
        if (!speaking) {
          if (rms >= START_THRESHOLD) {
            consecAbove += 1;
            if (consecAbove >= MIN_START_CONSEC_FRAMES) {
              speaking = true;
              speechStartTs = now;
              lastLoudTs = now;
            }
          } else {
            consecAbove = 0;
          }
          if (!speaking && now - startTs > MAX_WAIT_FOR_SPEECH_MS) {
            // No speech detected in time window; cancel this listen round
            cleanup();
            setIsRecording(false);
            setMicStatus("idle");
            try {
              setVuLevel(0);
              setVuBucket(0);
            } catch {}
            return;
          }
        } else {
          totalFrames += 1;
          if (rms >= STOP_THRESHOLD) {
            lastLoudTs = now;
            voicedFrames += 1;
          }
          const silentFor = now - lastLoudTs;
          const utterFor = now - (speechStartTs || startTs);
          if (silentFor >= SILENCE_MS || utterFor >= MAX_UTTERANCE_MS) {
            speechEndTs = now;
            // Decide whether this utterance is valid before stopping
            const durationMs = speechStartTs ? speechEndTs - speechStartTs : 0;
            const voicedRatio =
              totalFrames > 0 ? voicedFrames / totalFrames : 0;
            validUtterance =
              durationMs >= MIN_UTTER_MS &&
              voicedFrames >= MIN_VOICED_FRAMES &&
              voicedRatio >= MIN_VOICED_RATIO;
            try {
              mr.stop();
            } catch {}
          }
        }
      }, 50);

      // Await recorder stop and produce blob
      const blob: Blob | null = await new Promise((resolve) => {
        if (!mr) return resolve(null);
        mr.onstop = () => {
          setIsRecording(false);
          setMicStatus("stopped");
          if (micStatusTimerRef.current)
            window.clearTimeout(micStatusTimerRef.current);
          micStatusTimerRef.current = window.setTimeout(
            () => setMicStatus("idle"),
            1200
          );
          try {
            const b = new Blob(mediaChunksRef.current, { type: "audio/webm" });
            if (!validUtterance) {
              resolve(null);
            } else {
              resolve(b.size > 0 ? b : null);
            }
          } catch {
            resolve(null);
          }
          try {
            setVuLevel(0);
            setVuBucket(0);
          } catch {}
          cleanup();
        };
      });

      return blob;
    } catch (e: any) {
      console.error("listenOnceWithVAD error:", e);
      try {
        setIsRecording(false);
      } catch {}
      try {
        setMicStatus("idle");
      } catch {}
      // Surface error so user can fix mic
      if (e?.name === "NotAllowedError")
        setConvError(
          "Microphone permission denied. Please allow access in Site settings."
        );
      else if (e?.name === "NotFoundError")
        setConvError("No microphone found. Please connect a mic and retry.");
      else if (e?.message?.includes("MediaRecorder"))
        setConvError(
          "MediaRecorder not supported in this browser. Try Chrome or Edge."
        );
      else setConvError("Unable to access microphone.");
      return null;
    } finally {
      // Extra cleanup safety
      try {
        stream?.getTracks().forEach((t) => t.stop());
      } catch {}
    }
  };

  const isLikelyNonSpeech = (text: string): boolean => {
    const s = text.toLowerCase().trim();
    if (!s) return true;
    // Common stock mishears; extend as needed
    const blacklist = [
      "thanks for watching",
      "thank you for watching",
      "thanks for watching everyone",
    ];
    if (blacklist.some((b) => s.includes(b))) return true;
    // Too short or trivial
    const words = s.split(/\s+/).filter(Boolean);
    if (words.length <= 1 && s.length < 6) return true;
    // Mostly non-letter characters
    const letters = s.replace(/[^a-z]/g, "");
    if (letters.length < 3) return true;
    return false;
  };

  const isLikelyEcho = (candidate: string, lastReply: string): boolean => {
    const norm = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    const a = norm(candidate);
    const b = norm(lastReply);
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.length > 10 && (b.includes(a) || a.includes(b))) return true;
    return false;
  };

  const transcribeBlob = async (blob: Blob): Promise<string> => {
    try {
      // Use fast transcription pipeline with optimized audio processing
      const form = new FormData();
      form.append("audio", blob, "utterance.webm");
      const res = await fetch(getApiUrl("/api/transcribe-fast"), {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        // Toast: service error
        try {
          if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
        } catch {}
        setToastText("Transcription service error. Please try again.");
        toastTimerRef.current = window.setTimeout(() => setToastText(""), 4000);
        return "";
      }
      const data = (await res.json()) as { text?: string };
      return (data.text || "").trim();
    } catch {
      // Toast: network error
      try {
        if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      } catch {}
      setToastText("Network error talking to transcription service.");
      toastTimerRef.current = window.setTimeout(() => setToastText(""), 4000);
      return "";
    }
  };

  const chatReply = async (userText: string): Promise<string> => {
    const ua = messagesRef.current.filter((m) => m.sender !== "system");
    const maxMsgs = 16; // 8 pairs
    const bounded = ua.slice(Math.max(0, ua.length - maxMsgs));
    const history = bounded.map((m) => ({
      role: m.sender,
      content: m.text,
    })) as Array<{ role: "user" | "assistant"; content: string }>;
    try {
      const res = await fetch(getApiUrl("/api/chat-optimized"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-pt-scenario": scenarioId,
          "x-warmed-up": isWarmedUp ? "true" : "false", // Signal warmup status
        },
        body: JSON.stringify({
          message: userText,
          history,
          scenario: scenarioId,
        }),
      });
      if (!res.ok || !res.body) {
        try {
          if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
        } catch {}
        setToastText("Chat service error. Please try again.");
        toastTimerRef.current = window.setTimeout(() => setToastText(""), 4000);
        return "";
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullText = "";
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          acc += decoder.decode(value, { stream: true });
          const lines = acc.split(/\r?\n/);
          acc = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              fullText += data;
            }
          }
        }
      }
      return fullText.trim();
    } catch {
      try {
        if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      } catch {}
      setToastText("Network error talking to chat service.");
      toastTimerRef.current = window.setTimeout(() => setToastText(""), 4000);
      return "";
    }
  };

  const waitForAudioEnd = async (): Promise<void> => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    if (audio.paused) return;
    await new Promise<void>((resolve) => {
      const onEnd = () => {
        cleanup();
      };
      const cleanup = () => {
        audio.removeEventListener("ended", onEnd);
        audio.removeEventListener("pause", onEnd);
        resolve();
      };
      audio.addEventListener("ended", onEnd, { once: true });
      audio.addEventListener("pause", onEnd, { once: true });
    });
  };

  const runConversationalLoop = async () => {
    if (convRunningRef.current) return;
    convRunningRef.current = true;
    convAbortRef.current = new AbortController();
    const signal = convAbortRef.current.signal;

    try {
      while (conversationalOn && !signal.aborted) {
        convPhaseRef.current = "listening";
        setConvPhase("listening");
        // Safety timeout: if listening lasts too long without speech, reset to idle
        const listenStart = performance.now();
        let blob: Blob | null = null;
        try {
          blob = await listenOnceWithVAD(signal);
        } catch (err) {
          // Mic/recording error – exit conversational mode gracefully
          setConversationalOn(false);
          convPhaseRef.current = "idle";
          setConvPhase("idle");
          try {
            setVuLevel(0);
            setVuBucket(0);
          } catch {}
          break;
        }
        if (signal.aborted) break;
        if (!blob && performance.now() - listenStart > 6000) {
          // Prevent UI from appearing stuck in 'listening' indefinitely
          convPhaseRef.current = "idle";
          setConvPhase("idle");
        }
        if (!blob) {
          // No speech detected; continue listening
          continue;
        }

        // ULTRA-FAST PIPELINE: Use parallel processing for transcription + AI response
        // Note: don't switch to 'transcribing' yet; wait until we have an accepted transcript
        try {
          setVuLevel(0);
          setVuBucket(0);
        } catch {}

        // Build history for AI context
        const ua = messagesRef.current.filter((m) => m.sender !== "system");
        const maxMsgs = 16; // 8 pairs
        const bounded = ua.slice(Math.max(0, ua.length - maxMsgs));
        const history = bounded.map((m) => ({
          role: m.sender,
          content: m.text,
        })) as Array<{ role: "user" | "assistant"; content: string }>;

        // Use ultra-fast voice pipeline with progressive responses
        let userText = "";
        let aiResponse = "";

        try {
          await processVoiceToResponse(blob, scenarioId, history, {
            // Defer phase change until we accept the text
            onTranscriptionComplete: (text) => {
              userText = text.trim();
              if (userText) {
                // Guard against echo (capturing the assistant's own TTS)
                if (isLikelyEcho(userText, lastReplyRef.current)) {
                  userText = ""; // Mark as invalid
                  return;
                }
                // Guard against non-speech or stock mishears
                if (isLikelyNonSpeech(userText)) {
                  userText = ""; // Mark as invalid
                  return;
                }
                // Accept transcript: now move to transcribing
                convPhaseRef.current = "transcribing";
                setConvPhase("transcribing");
                // Add user message immediately after transcription
                setMessages((prev) => {
                  const next: Message = {
                    id: prev.length + 1,
                    text: userText,
                    sender: "user",
                    timestamp: new Date(),
                  };
                  return [...prev, next];
                });
              }
            },
            onResponseStart: () => {
              convPhaseRef.current = "chatting";
              setConvPhase("chatting");
            },
            onResponseComplete: (response) => {
              aiResponse = response.trim();
              if (aiResponse) {
                // Add AI response
                setMessages((prev) => {
                  const next: Message = {
                    id: prev.length + 1,
                    text: aiResponse,
                    sender: "assistant",
                    timestamp: new Date(),
                  };
                  return [...prev, next];
                });
                lastReplyRef.current = aiResponse;

                // Track voice processing performance
                if (voicePerformance) {
                  const isFirstInteraction =
                    optimizationMetrics.totalInteractions === 0;
                  const totalTime = voicePerformance.totalMs || 0;

                  trackVoicePerformance({
                    transcriptionTime: voicePerformance.transcriptionMs,
                    aiResponseTime: voicePerformance.aiResponseMs,
                    totalProcessingTime: totalTime,
                  });

                  // Track optimization outcomes
                  trackInteraction(
                    isFirstInteraction ? "first" : "subsequent",
                    totalTime
                  );

                  // Log performance achievements
                  if (isFirstInteraction && totalTime <= 1000) {
                    console.log(
                      "🎯 OPTIMIZATION SUCCESS: First response under 1 second!"
                    );
                  }
                  if (totalTime <= 2000) {
                    console.log(
                      "⚡ OPTIMIZATION SUCCESS: Voice processing under 2 seconds!"
                    );
                  }
                }
              }
            },
            onError: (error) => {
              console.error("Voice pipeline error:", error);
              trackError("voice-pipeline-error");
              // Add error/system message to keep context
              setMessages((prev) => [
                ...prev,
                {
                  id: (prev[prev.length - 1]?.id || 0) + 1,
                  text: "Sorry, I could not respond.",
                  sender: "system",
                  timestamp: new Date(),
                },
              ]);
            },
          });
        } catch (error) {
          console.error("Voice processing failed:", error);
          continue; // Skip this iteration and continue listening
        }

        if (signal.aborted) break;
        if (!userText || !aiResponse) {
          continue; // Skip to next listening cycle
        }

        convPhaseRef.current = "speaking";
        setConvPhase("speaking");
        try {
          setVuLevel(0);
          setVuBucket(0);
        } catch {}
        // Speak and wait until finished before resuming listening
        await speakText(aiResponse);
        await waitForAudioEnd();
        // Cooldown to let residual audio settle before listening resumes
        await new Promise((r) => setTimeout(r, 200));

        convPhaseRef.current = "idle";
        setConvPhase("idle");
        try {
          setVuLevel(0);
          setVuBucket(0);
        } catch {}
      }
    } finally {
      convRunningRef.current = false;
      convPhaseRef.current = "idle";
      setConvPhase("idle");
      try {
        setVuLevel(0);
        setVuBucket(0);
      } catch {}
    }
  };

  // Start Web Speech API recognition if available; fallback to MediaRecorder => /api/transcribe
  const startVoiceInput = async () => {
    if (isRecording) return;
    setMicStatus("listening");

    // Prefer Web Speech API for streaming dictation
    const SR: any =
      (window as any).webkitSpeechRecognition ||
      (window as any).SpeechRecognition;
    if (SR) {
      try {
        const rec = new SR();
        rec.lang = navigator.language || "en-US";
        rec.continuous = false;
        rec.interimResults = true;
        setIsRecording(true);

        rec.onresult = (ev: any) => {
          let finalText = "";
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const res = ev.results[i];
            if (res.isFinal) {
              finalText += res[0].transcript;
            }
          }
          if (!conversationalOn && finalText.trim()) {
            setInputValue((prev) =>
              prev ? prev + " " + finalText.trim() : finalText.trim()
            );
          }
        };
        const markStopped = () => {
          setIsRecording(false);
          setMicStatus("stopped");
          if (micStatusTimerRef.current)
            window.clearTimeout(micStatusTimerRef.current);
          micStatusTimerRef.current = window.setTimeout(
            () => setMicStatus("idle"),
            1500
          );
        };
        rec.onerror = () => {
          markStopped();
        };
        rec.onend = () => {
          markStopped();
        };
        rec.start();
        return;
      } catch {
        // fall through to MediaRecorder
      }
    }

    // Fallback: record short clip and send to /api/transcribe
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedInputId
            ? ({ exact: selectedInputId } as any)
            : undefined,
        } as any,
      });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mr;
      mediaChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) mediaChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        setIsRecording(false);
        setMicStatus("stopped");
        if (micStatusTimerRef.current)
          window.clearTimeout(micStatusTimerRef.current);
        micStatusTimerRef.current = window.setTimeout(
          () => setMicStatus("idle"),
          1500
        );
        try {
          const blob = new Blob(mediaChunksRef.current, { type: "audio/webm" });
          const form = new FormData();
          form.append("audio", blob, "clip.webm");
          const res = await fetch(getApiUrl("/api/transcribe"), {
            method: "POST",
            body: form,
          });
          if (!res.ok) {
            try {
              if (toastTimerRef.current)
                window.clearTimeout(toastTimerRef.current);
            } catch {}
            setToastText("Transcription service error. Please try again.");
            toastTimerRef.current = window.setTimeout(
              () => setToastText(""),
              4000
            );
          } else {
            const data = (await res.json()) as {
              text?: string;
              error?: string;
            };
            const txt = data.text || data.error || "";
            if (txt && !conversationalOn)
              setInputValue((prev) => (prev ? prev + " " + txt : txt));
          }
        } catch {
          try {
            if (toastTimerRef.current)
              window.clearTimeout(toastTimerRef.current);
          } catch {}
          setToastText("Network error talking to transcription service.");
          toastTimerRef.current = window.setTimeout(
            () => setToastText(""),
            4000
          );
        } finally {
          stream.getTracks().forEach((t) => t.stop());
        }
      };
      mr.start();
      setIsRecording(true);
      setMicStatus("listening");
    } catch (e) {
      console.error("Microphone error:", e);
    }
  };

  const stopVoiceInput = () => {
    const SR: any =
      (window as any).webkitSpeechRecognition ||
      (window as any).SpeechRecognition;
    // If using Web Speech API, there's no reference; stopping relies on the instance
    // For simplicity, we rely on end of speech; otherwise use MediaRecorder path
    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    setIsRecording(false);
    setMicStatus("stopped");
    if (micStatusTimerRef.current)
      window.clearTimeout(micStatusTimerRef.current);
    micStatusTimerRef.current = window.setTimeout(
      () => setMicStatus("idle"),
      1500
    );
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);

    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesRef.current = messages;
    if (threadRef.current) {
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches
        ? "auto"
        : "smooth";
      threadRef.current.scrollTo({
        top: threadRef.current.scrollHeight,
        behavior: behavior as ScrollBehavior,
      });
    }
  }, [messages, isTyping]);

  // Load saved preferences on mount and mark hydrated
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    console.log("🚀 useEffect (mount) called");

    if (typeof window !== "undefined") {
      console.log("🌍 Window is available, loading preferences");

      // System prompt no longer loaded from localStorage; backend controls prompt persona.

      const savedTheme = window.localStorage.getItem("chat-theme") || "light";
      console.log("🎨 Saved theme from localStorage:", savedTheme);
      console.log("🎨 Current theme state before update:", theme);

      // Update DOM immediately with correct theme
      if (typeof document !== "undefined") {
        console.log("🏷️ Setting initial data-theme attribute to:", savedTheme);
        document.documentElement.setAttribute("data-theme", savedTheme);
      }

      setTheme(savedTheme);
      console.log("🎨 Theme state updated to:", savedTheme);

      // Load TTS prefs (Cloud-only)
      try {
        const savedControls = window.localStorage.getItem("chat-controls-open");
        if (savedControls === "true" || savedControls === "false")
          setControlsOpen(savedControls === "true");
        const savedCloudVoice = window.localStorage.getItem(
          "chat-tts-cloud-voice"
        );
        if (
          savedCloudVoice &&
          SUPPORTED_CLOUD_VOICES.includes(savedCloudVoice as any)
        ) {
          setCloudVoice(savedCloudVoice);
        } else if (
          savedCloudVoice &&
          !SUPPORTED_CLOUD_VOICES.includes(savedCloudVoice as any)
        ) {
          setCloudVoice("alloy");
          window.localStorage.setItem("chat-tts-cloud-voice", "alloy");
        }
      } catch {}

      // Browser TTS removed

      setIsHydrated(true);
      console.log("💧 Component marked as hydrated");
      // Mark UI ready to enable CSS transitions post-hydration
      try {
        document.documentElement.setAttribute("data-ui-ready", "true");
      } catch {}
      // Restore previously selected microphone
      try {
        const savedMic =
          window.localStorage.getItem("chat-mic-device-id") || "";
        if (savedMic) setSelectedInputId(savedMic);
      } catch {}

      // Use setTimeout to ensure hydratedRef is set AFTER the theme useEffect completes
      setTimeout(() => {
        hydratedRef.current = true;
        console.log(
          "🔒 hydratedRef set to true - future theme changes will be persisted"
        );
      }, 0);
    } else {
      console.log("🌍 Window not available (SSR)");
    }
  }, []);

  // Cleanup mic status timeout on unmount
  useEffect(() => {
    return () => {
      if (micStatusTimerRef.current)
        window.clearTimeout(micStatusTimerRef.current);
    };
  }, []);

  // No client system prompt persistence

  // Persist and apply theme on change (only after hydration and for user actions)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    console.log(
      "🎨 Theme useEffect triggered with theme:",
      theme,
      "isHydrated:",
      isHydrated,
      "hydratedRef:",
      hydratedRef.current
    );

    // Only persist theme changes after component is hydrated AND this isn't the initial hydration
    if (!hydratedRef.current) {
      console.log(
        "⏸️ Skipping theme persistence - component not fully hydrated yet"
      );
      return;
    }

    if (typeof window !== "undefined") {
      console.log("💾 Saving theme to localStorage:", theme);
      window.localStorage.setItem("chat-theme", theme);
    }
    if (typeof document !== "undefined") {
      console.log("🏷️ Setting data-theme attribute to:", theme);
      document.documentElement.setAttribute("data-theme", theme);
      console.log(
        "🏷️ Current document data-theme:",
        document.documentElement.getAttribute("data-theme")
      );
    }
  }, [theme]);

  // Reflect controls open state to DOM and persist (after hydration)
  useEffect(() => {
    try {
      document.documentElement.setAttribute(
        "data-controls-open",
        controlsOpen ? "true" : "false"
      );
      if (typeof window !== "undefined" && hydratedRef.current) {
        window.localStorage.setItem(
          "chat-controls-open",
          controlsOpen ? "true" : "false"
        );
      }
    } catch {}
  }, [controlsOpen]);

  // Persist Cloud voice after hydration

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && hydratedRef.current) {
        window.localStorage.setItem("chat-tts-cloud-voice", cloudVoice);
      }
    } catch {}
  }, [cloudVoice]);

  // Start/stop conversational loop on toggle
  useEffect(() => {
    if (!isHydrated) return;
    if (conversationalOn) {
      // Optionally ensure replies are spoken while in conv mode
      if (!autoSpeak) setAutoSpeak(true);
      (async () => {
        const ok = await ensureMicAccess();
        if (!ok) return;
        await runConversationalLoop();
      })();
    } else {
      // Abort any in-flight listening or loop
      try {
        convAbortRef.current?.abort();
      } catch {}
    }
    // Cleanup on unmount
    return () => {
      try {
        convAbortRef.current?.abort();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationalOn, isHydrated]);

  return (
    <section className="chat-shell" aria-labelledby="chat-title">
      {/* Header */}
      <header className="chat-header">
        <div className="bar">
          <div className="chat-logo" aria-label="App logo">
            <Image src={LogoWhite} alt="EMR Chat" height={42} priority />
          </div>
          <div className="header-actions">
            {/* eslint-disable-next-line jsx-a11y/aria-proptypes */}
            <button
              type="button"
              className="icon-btn controls-toggle"
              aria-controls="system-controls"
              onClick={() => setControlsOpen((v) => !v)}
              title={controlsOpen ? "Hide settings" : "Show settings"}
            >
              <svg
                className={`chev ${controlsOpen ? "open" : "collapsed"}`}
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <div className="theme-toggle">
              <button
                type="button"
                className="theme-toggle-button"
                aria-label="Toggle theme"
                onClick={() => {
                  console.log("🔄 Toggle button clicked!");
                  console.log("🎨 Current theme before toggle:", theme);

                  setTheme((prev) => {
                    const newTheme = prev === "light" ? "dark" : "light";
                    console.log("🎨 Theme changing from", prev, "to", newTheme);
                    return newTheme;
                  });
                }}
                title="Toggle light/dark"
              >
                <div className="theme-toggle-track">
                  <div className="theme-toggle-thumb">
                    {/* Render both icons to avoid SSR/CSR mismatch; toggle via CSS */}
                    <svg
                      className="icon-sun"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z" />
                    </svg>
                    <svg
                      className="icon-moon"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M12.34 2.02C6.59 1.82 2 6.42 2 12.25c0 5.52 4.48 10 10 10 3.71 0 6.93-2.02 8.66-5.02-7.51-.25-12.09-8.43-8.32-15.21z" />
                    </svg>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Controls Panel */}
      <section
        id="system-controls"
        className={`chat-controls ${controlsOpen ? "open" : "collapsed"}`}
        aria-labelledby="controls-title"
      >
        <div className="controls-inner two-col">
          {/* Mic selection and status */}
          <div className="control-group">
            <label className="control-label" htmlFor="mic-device">
              Microphone
            </label>
            <div className="flex items-center gap-2">
              <select
                id="mic-device"
                className="control-select"
                aria-label="Microphone input device"
                value={selectedInputId}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedInputId(v);
                  try {
                    window.localStorage.setItem("chat-mic-device-id", v);
                  } catch {}
                }}
                onFocus={refreshInputDevices}
              >
                {inputDevices.length === 0 && <option value="">Default</option>}
                {inputDevices.map((d) => (
                  <option key={d.deviceId || d.label} value={d.deviceId}>
                    {d.label || "Microphone"}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="icon-btn"
                aria-label="Refresh microphones"
                title="Refresh microphones"
                onClick={refreshInputDevices}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0114.13-3.36L23 10M1 14l5.36 4.36A9 9 0 0020.49 15" />
                </svg>
              </button>
            </div>
            {convError && (
              <p className="text-xs mt-1 text-red-500" role="alert">
                {convError}
              </p>
            )}
          </div>
          {/* PT Scenario selection (first) */}
          <div className="control-group">
            <label className="control-label" htmlFor="pt-scenario">
              Patient case
            </label>
            <select
              id="pt-scenario"
              className="control-select"
              aria-label="Patient scenario"
              value={scenarioId}
              onChange={(e) => {
                const v = e.target.value;
                setScenarioId(v);
                try {
                  window.localStorage.setItem("chat-pt-scenario", v);
                } catch {}
              }}
            >
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {/* Voice (Cloud only) */}
          <div className="control-group">
            <label id="controls-title" className="control-label">
              Voice
            </label>
            {isHydrated && (
              <div className="mt-2">
                <VoiceSelect
                  voices={SUPPORTED_CLOUD_VOICES}
                  value={cloudVoice}
                  onChange={(v) => {
                    setCloudVoice(v);
                    try {
                      window.localStorage.setItem("chat-tts-cloud-voice", v);
                    } catch {}
                  }}
                  ariaLabel="Voice"
                />
              </div>
            )}
          </div>
          {/* control-actions removed per design simplification */}
        </div>
      </section>

      {/* Message Thread */}
      <main
        ref={threadRef}
        className="chat-thread"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Chat conversation"
      >
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.sender}`}>
            <div className="message-container">
              <div className="bubble-container">
                {message.sender === "assistant" && (
                  <div className="tts-outside-left">
                    {(() => {
                      const keyCloud = `cloud|${cloudVoice}|${message.text}`;
                      const isThisPlaying =
                        isSpeaking && currentTtsKey === keyCloud;
                      return (
                        <button
                          type="button"
                          className={`icon-btn tts-btn ${
                            isThisPlaying ? "active" : ""
                          }`}
                          aria-label={
                            isThisPlaying ? "Pause speaking" : "Play speaking"
                          }
                          onClick={() =>
                            togglePlayPauseForText(message.text, message.id)
                          }
                          title={isThisPlaying ? "Pause" : "Play"}
                        >
                          {isThisPlaying ? (
                            <PauseIcon size={18} />
                          ) : (
                            <PlayIcon size={18} />
                          )}
                        </button>
                      );
                    })()}
                  </div>
                )}
                {(() => {
                  const keyCloud = `cloud|${cloudVoice}|${message.text}`;
                  const isThisPlaying =
                    isSpeaking && currentTtsKey === keyCloud;
                  return (
                    <div className={`bubble ${isThisPlaying ? "playing" : ""}`}>
                      <div className="bubble-content">{message.text}</div>
                    </div>
                  );
                })()}
                {message.sender === "assistant" && (
                  <div className="bubble-actions mt-1 flex items-center gap-2">
                    {loadingByMessage[message.id] && (
                      <span
                        className="inline-flex items-center gap-1"
                        aria-live="polite"
                      >
                        <CircularProgress
                          size={14}
                          thickness={6}
                          sx={{ color: "var(--brand-accent)" }}
                        />
                        <span className="sr-only">Preparing audio…</span>
                      </span>
                    )}
                    {ttsErrorByMessage[message.id] && (
                      <span
                        className="tts-error"
                        title={ttsErrorByMessage[message.id]}
                      >
                        <span className="dot" aria-hidden="true"></span>
                        <span>Error</span>
                      </span>
                    )}
                    {/* Removed 'Playing' text; active state indicated via green highlights */}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="message assistant">
            <div className="message-container">
              <div className="bubble-container">
                {/* One-line spinner in place where play would be */}
                <div className="tts-outside-left">
                  <span
                    className="inline-flex items-center"
                    aria-label="Loading"
                    title="Loading"
                  >
                    <CircularProgress
                      size={14}
                      thickness={6}
                      sx={{ color: "var(--brand-accent)" }}
                    />
                  </span>
                </div>
                <div className="bubble typing-bubble">
                  <div className="typing-indicator sr-only">
                    Assistant is thinking…
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Suggestion Chips removed */}

      {/* Composer */}
      <footer className="composer">
        <form
          className="composer-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          aria-label="Send message"
        >
          <div className="input-container">
            <textarea
              ref={inputRef}
              id="chat-input"
              className="message-input"
              rows={1}
              value={inputValue}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={conversationalOn ? "" : "Type your message..."}
              aria-describedby="chat-help"
              maxLength={2000}
            />
            {/* Mic button on the right, ChatGPT-like */}
            <button
              type="button"
              className={`mic-button ${conversationalOn ? "active" : ""}`}
              aria-label={"Conversation"}
              title={"Conversation"}
              onClick={() => setConversationalOn((v) => !v)}
            >
              {/* microphone glyph */}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 1a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10a7 7 0 0 1-14 0" />
                <line x1="12" y1="17" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
            {/* Per-message TTS controls are shown inside each assistant bubble */}
            <button
              type="submit"
              className="send-button"
              disabled={!inputValue.trim()}
              aria-label="Send message"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path d="m22 2-7 20-4-9-9-4z" />
                <path d="M22 2 11 13" />
              </svg>
            </button>
          </div>
        </form>
      </footer>

      {/* Toast banner */}
      {toastText && (
        <div role="alert" aria-live="polite" className="toast-banner">
          <div className="inner">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12" y2="16"></line>
            </svg>
            <span>{toastText}</span>
            <button
              type="button"
              className="icon-btn"
              aria-label="Dismiss notification"
              onClick={() => setToastText("")}
              title="Dismiss"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating Conversation Overlay */}
      {conversationalOn && (
        <div
          className={`conv-overlay ${convPhase} vu-${
            convPhase === "speaking" ? audioVuBucket : vuBucket
          }`}
          role="status"
          aria-live="polite"
          aria-label={`Conversation mode: ${convPhase}`}
        >
          <button
            type="button"
            className="conv-close"
            aria-label="Stop conversation"
            title="Stop conversation"
            onClick={() => setConversationalOn(false)}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div className="conv-label">
            <span className="dot" aria-hidden="true"></span>
            <span>
              {convPhase === "listening" && "Listening…"}
              {convPhase === "transcribing" && "Transcribing…"}
              {convPhase === "chatting" && "Thinking…"}
              {convPhase === "speaking" && "Speaking…"}
              {convPhase === "idle" && "Ready"}
            </span>
          </div>
          <div className="conv-bars" aria-hidden="true">
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} className="bar" />
            ))}
          </div>
        </div>
      )}

      {/* Removed Perf Tracking overlay */}
    </section>
  );
}
