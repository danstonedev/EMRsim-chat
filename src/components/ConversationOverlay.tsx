// Conversation Overlay - Dynamically imported to reduce initial bundle size
import React from "react";
import { ConversationState } from "./ConversationHandler";

interface ConversationOverlayProps {
  state: ConversationState;
  onToggle: () => void;
  vuMeterLevels: { left: number; right: number };
}

export const ConversationOverlay: React.FC<ConversationOverlayProps> = ({
  state,
  onToggle,
  vuMeterLevels,
}) => {
  if (!state.isActive) return null;

  const getPhaseMessage = () => {
    switch (state.phase) {
      case "listening":
        return "👂 Listening...";
      case "processing":
        return "🤔 Processing...";
      case "speaking":
        return "🗣️ Speaking...";
      default:
        return "⏸️ Idle";
    }
  };

  const getPhaseColor = () => {
    switch (state.phase) {
      case "listening":
        return "#4ade80"; // green
      case "processing":
        return "#fbbf24"; // amber
      case "speaking":
        return "#60a5fa"; // blue
      default:
        return "#9ca3af"; // gray
    }
  };

  return (
    <div className="conversation-overlay">
      <div className="conversation-modal">
        {/* Header */}
        <div className="conversation-header">
          <h3>Conversation Mode</h3>
          <button
            onClick={onToggle}
            className="conversation-close"
            aria-label="Close conversation mode"
          >
            ×
          </button>
        </div>

        {/* Status */}
        <div className="conversation-status">
          <div className={`status-indicator ${state.phase}`} />
          <span className="status-text">{getPhaseMessage()}</span>
        </div>

        {/* VU Meter */}
        {state.isListening && (
          <div className="vu-meter">
            <div className="vu-label">Audio Level</div>
            <div className="vu-bars">
              <div
                className={`vu-bar left ${
                  vuMeterLevels.left > 0.7 ? "high" : "normal"
                }`}
                style={
                  {
                    "--vu-height": `${Math.max(2, vuMeterLevels.left * 100)}%`,
                  } as React.CSSProperties
                }
              />
              <div
                className={`vu-bar right ${
                  vuMeterLevels.right > 0.7 ? "high" : "normal"
                }`}
                style={
                  {
                    "--vu-height": `${Math.max(2, vuMeterLevels.right * 100)}%`,
                  } as React.CSSProperties
                }
              />
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="conversation-instructions">
          <p>
            {state.phase === "listening" &&
              "Speak naturally. I'll respond when you're done."}
            {state.phase === "processing" && "Processing your message..."}
            {state.phase === "speaking" &&
              "I'm responding. I'll listen again when done."}
            {state.phase === "idle" && "Conversation paused. Click to resume."}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ConversationOverlay;
