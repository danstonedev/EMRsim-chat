"use client";

import React, { useState, useEffect } from "react";
import {
  globalPerfTester,
  PerformanceReport,
  performanceTests,
} from "../lib/performance/testing-core";
import "../styles/performance-monitor.css";

interface PerformanceMonitorProps {
  showStats?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function PerformanceMonitor({
  showStats = false,
  autoRefresh = true,
  refreshInterval = 1000,
}: PerformanceMonitorProps) {
  const [stats, setStats] = useState<PerformanceReport | null>(null);
  const [isVisible, setIsVisible] = useState(showStats);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (!isVisible || !autoRefresh) return;

    const interval = setInterval(() => {
      setStats(globalPerfTester.generateReport());
    }, refreshInterval);

    // Initial load
    setStats(globalPerfTester.generateReport());

    return () => clearInterval(interval);
  }, [isVisible, autoRefresh, refreshInterval]);

  const runTests = async () => {
    console.log("🚀 Running performance tests...");

    // Test chat response
    await performanceTests.testChatResponse();

    // Test memory (short version)
    const memInterval = performanceTests.testMemoryUsage();
    setTimeout(() => clearInterval(memInterval), 5000);

    // Update stats
    setStats(globalPerfTester.generateReport());
  };

  if (!isVisible) {
    return (
      <button
        className="performance-toggle-btn"
        onClick={() => setIsVisible(true)}
        title="Show Performance Monitor"
      >
        📊
      </button>
    );
  }

  if (!stats) return null;

  return (
    <div className={`performance-monitor ${isMinimized ? "minimized" : ""}`}>
      <div className="performance-header">
        <h3>Performance Monitor</h3>
        <div className="performance-controls">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? "Expand" : "Minimize"}
          >
            {isMinimized ? "⬆️" : "⬇️"}
          </button>
          <button onClick={() => setIsVisible(false)} title="Close">
            ❌
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="performance-metrics">
            <div className="metric-group">
              <h4>Current Metrics</h4>
              <div className="metric">
                <span className="metric-label">Memory:</span>
                <span className="metric-value">
                  {stats.metrics.memoryUsage?.toFixed(1)}MB
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Renders:</span>
                <span className="metric-value">
                  {stats.metrics.renderCount}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Chat Response:</span>
                <span className="metric-value">
                  {stats.metrics.chatResponseTime?.toFixed(0)}ms
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Conversation:</span>
                <span className="metric-value">
                  {stats.metrics.conversationLatency?.toFixed(0)}ms
                </span>
              </div>
            </div>

            <div className="metric-group">
              <h4>Performance vs Baseline</h4>
              {Object.entries(stats.comparison).map(([key, data]) => (
                <div key={key} className="improvement-metric">
                  <span className="metric-label">
                    {key.replace(/([A-Z])/g, " $1").trim()}:
                  </span>
                  <span
                    className={`improvement-value ${
                      data.improvement > 0 ? "positive" : "negative"
                    }`}
                  >
                    {data.improvement > 0 ? "↗️" : "↘️"}{" "}
                    {Math.abs(data.improvement).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="performance-actions">
            <button onClick={runTests} className="test-btn">
              Run Tests
            </button>
            <button
              onClick={() => performanceTests.generateFullReport()}
              className="report-btn"
            >
              Console Report
            </button>
            <button
              onClick={() => setStats(globalPerfTester.generateReport())}
              className="refresh-btn"
            >
              Refresh
            </button>
          </div>

          {stats.recommendations.length > 0 && (
            <div className="recommendations">
              <h4>Recommendations:</h4>
              <ul>
                {stats.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Hook for integrating performance tracking into components
export function usePerformanceTracking(componentName: string) {
  useEffect(() => {
    globalPerfTester.trackRender();
  });

  const startTiming = (operation: string) => {
    globalPerfTester.startTiming(`${componentName}-${operation}`);
  };

  const endTiming = (operation: string) => {
    return globalPerfTester.endTiming(`${componentName}-${operation}`);
  };

  const trackEvent = (eventName: string, duration?: number) => {
    if (duration) {
      globalPerfTester.endTiming(eventName);
    } else {
      globalPerfTester.startTiming(eventName);
    }
  };

  return { startTiming, endTiming, trackEvent };
}

export default PerformanceMonitor;
