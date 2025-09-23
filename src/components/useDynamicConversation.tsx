// Dynamic import hook for conversation components
import { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import type { ConversationState } from "./ConversationHandler";

// Dynamically imported overlay component (main performance benefit)
const ConversationOverlay = dynamic(() => import("./ConversationOverlay"), {
  loading: () => <div>Loading conversation...</div>,
  ssr: false,
});

export interface ConversationHookOptions {
  onTranscript: (text: string) => void;
  onError: (error: string) => void;
}

export const useDynamicConversation = ({
  onTranscript,
  onError,
}: ConversationHookOptions) => {
  const [isActive, setIsActive] = useState(false);
  const [state, setState] = useState<ConversationState>({
    isActive: false,
    isListening: false,
    isSpeaking: false,
    phase: "idle",
  });
  const [vuMeterLevels, setVuMeterLevels] = useState({ left: 0, right: 0 });

  // Keep reference to handler for cleanup
  const handlerRef = useRef<any>(null);

  // Flag to track if components are loaded
  const [componentsLoaded, setComponentsLoaded] = useState(false);

  const initializeHandler = useCallback(async () => {
    if (handlerRef.current || componentsLoaded) return;

    try {
      // Dynamically import conversation handler class
      const { ConversationHandler } = await import("./ConversationHandler");

      handlerRef.current = new ConversationHandler({
        onStateChange: setState,
        onTranscript,
        onError,
      });

      setComponentsLoaded(true);
    } catch (error) {
      onError("Failed to load conversation components");
    }
  }, [onTranscript, onError, componentsLoaded]);

  const startConversation = useCallback(async () => {
    if (!componentsLoaded) {
      await initializeHandler();
    }

    if (handlerRef.current) {
      handlerRef.current.startConversation();
      setIsActive(true);
    }
  }, [componentsLoaded, initializeHandler]);

  const stopConversation = useCallback(() => {
    if (handlerRef.current) {
      handlerRef.current.stopConversation();
    }
    setIsActive(false);
    setState({
      isActive: false,
      isListening: false,
      isSpeaking: false,
      phase: "idle",
    });
  }, []);

  const toggleConversation = useCallback(async () => {
    if (isActive) {
      stopConversation();
    } else {
      await startConversation();
    }
  }, [isActive, startConversation, stopConversation]);

  const setSpeaking = useCallback((speaking: boolean) => {
    if (handlerRef.current) {
      handlerRef.current.setSpeaking(speaking);
    }
  }, []);

  // VU meter simulation (would be connected to actual audio analysis in real implementation)
  const updateVuMeter = useCallback(
    (levels: { left: number; right: number }) => {
      setVuMeterLevels(levels);
    },
    []
  );

  // Render the overlay (only if components are loaded and active)
  const renderOverlay = useCallback(() => {
    if (!componentsLoaded || !isActive) return null;

    return (
      <ConversationOverlay
        state={state}
        onToggle={toggleConversation}
        vuMeterLevels={vuMeterLevels}
      />
    );
  }, [componentsLoaded, isActive, state, toggleConversation, vuMeterLevels]);

  return {
    isActive,
    state,
    vuMeterLevels,
    toggleConversation,
    setSpeaking,
    updateVuMeter,
    renderOverlay,
    componentsLoaded,
  };
};
