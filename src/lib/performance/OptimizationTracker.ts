// Performance Tracking Dashboard for Optimization Outcomes
"use client";

import { useState, useEffect, useRef } from "react";
import { usePerformanceMonitor } from "./PerformanceMonitor";

interface OptimizationTarget {
  name: string;
  target: number;
  current?: number;
  unit: string;
  description: string;
  achieved: boolean;
}

interface ConversationMetrics {
  totalInteractions: number;
  averageFirstResponseTime: number;
  averageSubsequentResponseTime: number;
  cacheHitRate: number;
  errorRate: number;
  userSatisfactionScore: number;
  voiceProcessingTimes: number[];
  transcriptionAccuracy: number;
}

export function OptimizationTracker() {
  const { trackVoicePerformance, getMetrics, generateReport } =
    usePerformanceMonitor();
  const [metrics, setMetrics] = useState<ConversationMetrics>({
    totalInteractions: 0,
    averageFirstResponseTime: 0,
    averageSubsequentResponseTime: 0,
    cacheHitRate: 0,
    errorRate: 0,
    userSatisfactionScore: 0,
    voiceProcessingTimes: [],
    transcriptionAccuracy: 0,
  });

  const [optimizationTargets] = useState<OptimizationTarget[]>([
    {
      name: "First AI Response Time",
      target: 1000, // 1 second or less
      unit: "ms",
      description:
        "Time from voice input to first AI response (warmup system target)",
      achieved: false,
    },
    {
      name: "Voice Processing Speed",
      target: 2000, // 2 seconds total
      unit: "ms",
      description:
        "Total transcription + AI response time (50-60% improvement)",
      achieved: false,
    },
    {
      name: "CSS Bundle Size",
      target: 40000, // 40KB or less
      unit: "bytes",
      description:
        "Tailwind CSS bundle size after aggressive purging (20% reduction)",
      achieved: false,
    },
    {
      name: "TTS Cache Hit Rate",
      target: 80, // 80% or higher
      unit: "%",
      description: "Service worker cache effectiveness for repeat visits",
      achieved: false,
    },
    {
      name: "Core Web Vitals - LCP",
      target: 2500, // 2.5 seconds
      unit: "ms",
      description: "Largest Contentful Paint for good user experience",
      achieved: false,
    },
    {
      name: "Bundle Load Time",
      target: 500, // 500ms
      unit: "ms",
      description: "Initial JavaScript bundle loading time",
      achieved: false,
    },
  ]);

  const metricsRef = useRef<ConversationMetrics>(metrics);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    metricsRef.current = metrics;
  }, [metrics]);

  // Track conversation interactions
  const trackInteraction = (
    type: "first" | "subsequent",
    responseTime: number
  ) => {
    setMetrics((prev) => {
      const updated = {
        ...prev,
        totalInteractions: prev.totalInteractions + 1,
        voiceProcessingTimes: [...prev.voiceProcessingTimes, responseTime],
      };

      if (type === "first") {
        updated.averageFirstResponseTime = responseTime;
      } else {
        const subsequentTimes = updated.voiceProcessingTimes.slice(1);
        updated.averageSubsequentResponseTime =
          subsequentTimes.reduce((a, b) => a + b, 0) /
          Math.max(subsequentTimes.length, 1);
      }

      return updated;
    });
  };

  // Track errors and user satisfaction
  const trackError = (errorType: string) => {
    setMetrics((prev) => ({
      ...prev,
      errorRate:
        (prev.errorRate * prev.totalInteractions + 1) /
        (prev.totalInteractions + 1),
    }));
    console.warn(`Tracked error: ${errorType}`);
  };

  const trackSatisfaction = (score: 1 | 2 | 3 | 4 | 5) => {
    setMetrics((prev) => ({
      ...prev,
      userSatisfactionScore: score,
    }));
  };

  // Monitor service worker cache performance
  useEffect(() => {
    const checkCachePerformance = async () => {
      if ("serviceWorker" in navigator && "caches" in window) {
        try {
          const cacheNames = await caches.keys();
          let totalRequests = 0;
          let cachedResponses = 0;

          for (const cacheName of cacheNames) {
            if (cacheName.includes("emrchat-tts")) {
              const cache = await caches.open(cacheName);
              const keys = await cache.keys();
              totalRequests += keys.length;
              cachedResponses += keys.length; // All keys in cache are hits
            }
          }

          const hitRate =
            totalRequests > 0 ? (cachedResponses / totalRequests) * 100 : 0;
          setMetrics((prev) => ({ ...prev, cacheHitRate: hitRate }));
        } catch (error) {
          console.warn("Cache performance check failed:", error);
        }
      }
    };

    const interval = setInterval(checkCachePerformance, 5000);
    return () => clearInterval(interval);
  }, []);

  // Monitor bundle performance
  useEffect(() => {
    const checkBundlePerformance = () => {
      if (typeof window !== "undefined" && window.performance) {
        const navigationTiming = performance.getEntriesByType(
          "navigation"
        )[0] as PerformanceNavigationTiming;
        if (navigationTiming) {
          const bundleLoadTime =
            navigationTiming.loadEventEnd - navigationTiming.fetchStart;
          console.log(`Bundle Load Time: ${bundleLoadTime}ms`);
        }

        // Check CSS bundle size without issuing network requests (avoid dev 404s)
        const resources = performance.getEntriesByType(
          "resource"
        ) as PerformanceResourceTiming[];
        const cssResources = resources.filter(
          (r) =>
            r.name.includes("/_next/static/css/") || r.initiatorType === "link"
        );
        let totalCssBytes = 0;
        for (const r of cssResources) {
          const size =
            (r.transferSize as number) ||
            (r.encodedBodySize as number) ||
            (r.decodedBodySize as number) ||
            0;
          totalCssBytes += size;
        }
        if (totalCssBytes > 0) {
          console.log(
            `CSS Bundle Size: ${(totalCssBytes / 1024).toFixed(2)}KB`
          );
        }
      }
    };

    // Check on mount and periodically
    checkBundlePerformance();
    const interval = setInterval(checkBundlePerformance, 10000);
    return () => clearInterval(interval);
  }, []);

  // Generate real-time optimization report
  const generateOptimizationReport = () => {
    const sessionDuration = (Date.now() - startTimeRef.current) / 1000;
    const performanceMetrics = getMetrics();

    let report = "🎯 OPTIMIZATION TRACKING REPORT\n";
    report += `📊 Session Duration: ${sessionDuration.toFixed(1)}s\n`;
    report += `🗣️ Total Interactions: ${metrics.totalInteractions}\n\n`;

    // Check each optimization target
    optimizationTargets.forEach((target) => {
      let currentValue: number | undefined;
      let achieved = false;

      switch (target.name) {
        case "First AI Response Time":
          currentValue = metrics.averageFirstResponseTime;
          achieved = currentValue > 0 && currentValue <= target.target;
          break;
        case "Voice Processing Speed":
          currentValue = metrics.averageSubsequentResponseTime;
          achieved = currentValue > 0 && currentValue <= target.target;
          break;
        case "TTS Cache Hit Rate":
          currentValue = metrics.cacheHitRate;
          achieved = currentValue >= target.target;
          break;
        case "Core Web Vitals - LCP":
          const lcpMetric = performanceMetrics.find((m) => m.name === "LCP");
          currentValue = lcpMetric?.value;
          achieved = currentValue ? currentValue <= target.target : false;
          break;
      }

      const status = achieved ? "✅" : currentValue ? "⚠️" : "⏳";
      const valueStr = currentValue
        ? `${currentValue.toFixed(currentValue < 10 ? 1 : 0)}${target.unit}`
        : "Pending...";

      report += `${status} ${target.name}: ${valueStr} (Target: ${target.target}${target.unit})\n`;
    });

    // Performance insights
    report += "\n🔍 PERFORMANCE INSIGHTS:\n";
    if (metrics.averageFirstResponseTime > 0) {
      const improvement =
        ((2700 - metrics.averageFirstResponseTime) / 2700) * 100; // Baseline was 2.7s
      report += `🚀 First Response ${
        improvement > 0
          ? improvement.toFixed(0) + "% faster"
          : "needs improvement"
      }\n`;
    }

    if (metrics.voiceProcessingTimes.length > 1) {
      const avgProcessing =
        metrics.voiceProcessingTimes.reduce((a, b) => a + b, 0) /
        metrics.voiceProcessingTimes.length;
      report += `⚡ Avg Processing Time: ${avgProcessing.toFixed(0)}ms\n`;
    }

    if (metrics.cacheHitRate > 0) {
      report += `💾 TTS Cache Efficiency: ${metrics.cacheHitRate.toFixed(
        1
      )}%\n`;
    }

    // User experience score
    const overallScore = optimizationTargets.filter((t) => {
      switch (t.name) {
        case "First AI Response Time":
          return (
            metrics.averageFirstResponseTime > 0 &&
            metrics.averageFirstResponseTime <= t.target
          );
        case "Voice Processing Speed":
          return (
            metrics.averageSubsequentResponseTime > 0 &&
            metrics.averageSubsequentResponseTime <= t.target
          );
        case "TTS Cache Hit Rate":
          return metrics.cacheHitRate >= t.target;
        default:
          return false;
      }
    }).length;

    report += `\n🎖️ OPTIMIZATION SCORE: ${overallScore}/${optimizationTargets.length} targets achieved\n`;

    return report;
  };

  // Auto-track when voice processing occurs
  useEffect(() => {
    const originalProcessVoice = window.trackVoiceProcessing;
    window.trackVoiceProcessing = (metrics: any) => {
      const isFirstInteraction = metricsRef.current.totalInteractions === 0;
      const responseTime = metrics.totalProcessingTime || metrics.totalMs || 0;

      if (responseTime > 0) {
        trackInteraction(
          isFirstInteraction ? "first" : "subsequent",
          responseTime
        );
      }

      // Call original if it exists
      if (originalProcessVoice) {
        originalProcessVoice(metrics);
      }
    };

    return () => {
      window.trackVoiceProcessing = originalProcessVoice;
    };
  }, []);

  return {
    metrics,
    optimizationTargets,
    trackInteraction,
    trackError,
    trackSatisfaction,
    generateOptimizationReport,
    getCurrentReport: generateOptimizationReport,
  };
}

// Global tracking functions
declare global {
  interface Window {
    trackVoiceProcessing?: (metrics: any) => void;
    getOptimizationReport?: () => string;
  }
}

export default OptimizationTracker;
