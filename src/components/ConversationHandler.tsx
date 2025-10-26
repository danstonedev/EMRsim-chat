// Conversation Mode Handler - Dynamically imported to reduce initial bundle size
import { useState, useRef, useCallback, useEffect } from "react";

export interface ConversationState {
  isActive: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  phase: "idle" | "listening" | "processing" | "speaking";
}

export interface ConversationHandlerProps {
  onStateChange: (state: ConversationState) => void;
  onTranscript: (text: string) => void;
  onError: (error: string) => void;
}

export class ConversationHandler {
  private recognitionRef: SpeechRecognition | null = null;
  private state: ConversationState = {
    isActive: false,
    isListening: false,
    isSpeaking: false,
    phase: "idle",
  };
  private onStateChange: (state: ConversationState) => void;
  private onTranscript: (text: string) => void;
  private onError: (error: string) => void;
  private abortController: AbortController | null = null;

  constructor({
    onStateChange,
    onTranscript,
    onError,
  }: ConversationHandlerProps) {
    this.onStateChange = onStateChange;
    this.onTranscript = onTranscript;
    this.onError = onError;
    this.initializeSpeechRecognition();
  }

  private initializeSpeechRecognition() {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.onError("Speech recognition not supported in this browser");
      return;
    }

  this.recognitionRef = new SpeechRecognition();
  this.recognitionRef.continuous = true;
  this.recognitionRef.interimResults = true;
  // Language selection with optional "language lock":
  // If Advanced Settings has languageLock=true and an explicit inputLanguage (not 'auto'),
  // prefer that locale for browser STT. Otherwise, fall back to browser locale.
  try {
    const raw = window.localStorage.getItem('app.advancedSettings.v1');
    const parsed = raw ? JSON.parse(raw) : null;
    const lock = !!parsed?.languageLock;
    const inputLang: string | undefined = parsed?.inputLanguage;
    const lang = (() => {
      if (lock && inputLang && inputLang !== 'auto') {
        // Map base lang to a reasonable BCP-47 tag
        const base = String(inputLang).toLowerCase();
        const map: Record<string, string> = {
          en: 'en-US',
          'en-us': 'en-US',
          'en-gb': 'en-GB',
          es: 'es-ES',
          fr: 'fr-FR',
          de: 'de-DE',
          pt: 'pt-PT',
          it: 'it-IT',
          zh: 'zh-CN',
          ja: 'ja-JP',
          ko: 'ko-KR',
          ru: 'ru-RU',
        };
        return map[base] || map[base.split('-')[0]] || 'en-US';
      }
      return (typeof navigator !== 'undefined' && (navigator as any).language) || 'en-US';
    })();
    this.recognitionRef.lang = lang;
  } catch {
    // Prefer browser locale when available; fall back to en-US
    this.recognitionRef.lang = (typeof navigator !== 'undefined' && (navigator as any).language) || 'en-US';
  }

    this.recognitionRef.onstart = () => {
      this.updateState({ isListening: true, phase: "listening" });
    };

    this.recognitionRef.onend = () => {
      this.updateState({ isListening: false });
      if (this.state.isActive) {
        // Restart recognition if conversation is still active
        setTimeout(() => {
          if (this.state.isActive && !this.state.isSpeaking) {
            this.startListening();
          }
        }, 100);
      }
    };

    this.recognitionRef.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript.trim()) {
        this.onTranscript(finalTranscript.trim());
        this.updateState({ phase: "processing" });
      }
    };

    this.recognitionRef.onerror = (event) => {
      this.onError(`Speech recognition error: ${event.error}`);
    };
  }

  private updateState(updates: Partial<ConversationState>) {
    this.state = { ...this.state, ...updates };
    this.onStateChange(this.state);
  }

  public startConversation() {
    if (!this.recognitionRef) {
      this.onError("Speech recognition not initialized");
      return;
    }

    this.abortController = new AbortController();
    this.updateState({
      isActive: true,
      phase: "listening",
      isListening: false,
      isSpeaking: false,
    });
    this.startListening();
  }

  public stopConversation() {
    this.updateState({
      isActive: false,
      phase: "idle",
      isListening: false,
      isSpeaking: false,
    });

    if (this.recognitionRef) {
      try {
        this.recognitionRef.stop();
      } catch (error) {
        console.warn("Error stopping speech recognition:", error);
      }
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private startListening() {
    if (!this.recognitionRef || !this.state.isActive || this.state.isSpeaking)
      return;

    try {
      this.recognitionRef.start();
    } catch (error) {
      console.warn("Speech recognition already running");
    }
  }

  public setSpeaking(speaking: boolean) {
    this.updateState({
      isSpeaking: speaking,
      phase: speaking ? "speaking" : "listening",
    });

    if (!speaking && this.state.isActive) {
      // Resume listening after speaking
      setTimeout(() => this.startListening(), 500);
    }
  }

  public getState(): ConversationState {
    return { ...this.state };
  }

  public destroy() {
    this.stopConversation();
    this.recognitionRef = null;
  }
}

// React hook for easier integration
export const useConversationHandler = () => {
  const [state, setState] = useState<ConversationState>({
    isActive: false,
    isListening: false,
    isSpeaking: false,
    phase: "idle",
  });

  const handlerRef = useRef<ConversationHandler | null>(null);

  const initialize = useCallback((props: ConversationHandlerProps) => {
    if (handlerRef.current) {
      handlerRef.current.destroy();
    }
    handlerRef.current = new ConversationHandler(props);
  }, []);

  const start = useCallback(() => {
    handlerRef.current?.startConversation();
  }, []);

  const stop = useCallback(() => {
    handlerRef.current?.stopConversation();
  }, []);

  const setSpeaking = useCallback((speaking: boolean) => {
    handlerRef.current?.setSpeaking(speaking);
  }, []);

  useEffect(() => {
    return () => {
      handlerRef.current?.destroy();
    };
  }, []);

  return {
    state,
    initialize,
    start,
    stop,
    setSpeaking,
  };
};
