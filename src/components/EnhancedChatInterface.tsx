// Example integration of performance monitoring in your existing chat interface
"use client";

import { useEffect } from "react";
import ChatInterface from "./ChatInterface"; // Your existing component
import PerformanceMonitor from "./PerformanceMonitor";
import { usePerformanceTracking } from "./PerformanceMonitor";
import { globalPerfTester } from "../lib/performance/testing-core";

export default function EnhancedChatInterface() {
  const { startTiming, endTiming } = usePerformanceTracking("ChatInterface");

  // Track chat performance
  const handleSendMessage = async (message: string) => {
    startTiming("chat-response");

    try {
      // Your existing chat logic here
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const duration = endTiming("chat-response");
      console.log(`💬 Chat response took: ${duration.toFixed(2)}ms`);

      return response;
    } catch (error) {
      endTiming("chat-response");
      throw error;
    }
  };

  // Track conversation mode performance
  const handleConversationStart = () => {
    startTiming("conversation-setup");
    globalPerfTester.startTiming("conversation-loop");
  };

  const handleConversationEnd = () => {
    const setupTime = endTiming("conversation-setup");
    const loopTime = globalPerfTester.endTiming("conversation-loop");

    console.log(`🎙️ Conversation setup: ${setupTime.toFixed(2)}ms`);
    console.log(`🔄 Total conversation time: ${loopTime.toFixed(2)}ms`);
  };

  // Log performance report on mount
  useEffect(() => {
    console.log("🚀 Performance tracking initialized");

    // Generate initial report after 5 seconds
    setTimeout(() => {
      const report = globalPerfTester.generateReport();
      console.group("📊 Initial Performance Report");
      console.log("Metrics:", report.metrics);
      console.log("Improvements:", report.comparison);
      console.groupEnd();
    }, 5000);
  }, []);

  return (
    <>
      <ChatInterface />

      {/* Add performance monitor - shows in development */}
      {process.env.NODE_ENV === "development" && (
        <PerformanceMonitor showStats={true} />
      )}
    </>
  );
}
