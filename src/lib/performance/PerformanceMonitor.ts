// Core Web Vitals and Performance Monitoring
"use client";

import { useEffect } from "react";

interface PerformanceMetric {
  name: string;
  value: number;
  id: string;
  delta: number;
  rating: "good" | "needs-improvement" | "poor";
}

interface VoicePerformanceMetrics {
  transcriptionTime?: number;
  aiResponseTime?: number;
  totalProcessingTime?: number;
  cacheHitRate?: number;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, PerformanceMetric> = new Map();
  private voiceMetrics: VoicePerformanceMetrics = {};
  private observers: PerformanceObserver[] = [];

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  constructor() {
    if (typeof window !== "undefined") {
      this.initializeObservers();
      this.trackCustomMetrics();
    }
  }

  private initializeObservers() {
    // Track Core Web Vitals
    try {
      // Largest Contentful Paint (LCP)
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry;
        this.recordMetric("LCP", lastEntry.startTime);
      });
      lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });
      this.observers.push(lcpObserver);

      // First Input Delay (FID)
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.recordMetric("FID", entry.processingStart - entry.startTime);
        });
      });
      fidObserver.observe({ entryTypes: ["first-input"] });
      this.observers.push(fidObserver);

      // Cumulative Layout Shift (CLS)
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        let clsValue = 0;
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        this.recordMetric("CLS", clsValue);
      });
      clsObserver.observe({ entryTypes: ["layout-shift"] });
      this.observers.push(clsObserver);

      // Time to First Byte (TTFB)
      const navigationObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.recordMetric("TTFB", entry.responseStart - entry.requestStart);
        });
      });
      navigationObserver.observe({ entryTypes: ["navigation"] });
      this.observers.push(navigationObserver);
    } catch (error) {
      console.warn("Performance Observer not supported:", error);
    }
  }

  private trackCustomMetrics() {
    // Track service worker cache performance
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        // Measure cache effectiveness
        this.measureCachePerformance();
      });
    }

    // Track JavaScript bundle loading
    this.trackResourceTiming();
  }

  private recordMetric(name: string, value: number) {
    const rating = this.getRating(name, value);
    const metric: PerformanceMetric = {
      name,
      value,
      id: `${name}-${Date.now()}`,
      delta: value,
      rating,
    };

    this.metrics.set(name, metric);

    // Log significant performance issues
    if (rating === "poor") {
      console.warn(`Poor ${name} performance:`, value);
    }

    // Send to analytics (if configured)
    this.sendToAnalytics(metric);
  }

  private getRating(
    name: string,
    value: number
  ): "good" | "needs-improvement" | "poor" {
    const thresholds = {
      LCP: { good: 2500, poor: 4000 },
      FID: { good: 100, poor: 300 },
      CLS: { good: 0.1, poor: 0.25 },
      TTFB: { good: 800, poor: 1800 },
    };

    const threshold = thresholds[name as keyof typeof thresholds];
    if (!threshold) return "good";

    if (value <= threshold.good) return "good";
    if (value <= threshold.poor) return "needs-improvement";
    return "poor";
  }

  private async measureCachePerformance() {
    try {
      const cacheNames = await caches.keys();
      let totalSize = 0;
      let hitCount = 0;
      let totalRequests = 0;

      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        totalRequests += keys.length;

        for (const request of keys) {
          const response = await cache.match(request);
          if (response) {
            hitCount++;
            const blob = await response.blob();
            totalSize += blob.size;
          }
        }
      }

      const cacheHitRate =
        totalRequests > 0 ? (hitCount / totalRequests) * 100 : 0;
      this.voiceMetrics.cacheHitRate = cacheHitRate;

      console.log(
        `Cache Performance: ${cacheHitRate.toFixed(1)}% hit rate, ${(
          totalSize /
          1024 /
          1024
        ).toFixed(2)}MB cached`
      );
    } catch (error) {
      console.warn("Cache performance measurement failed:", error);
    }
  }

  private trackResourceTiming() {
    // Monitor critical resource loading times
    window.addEventListener("load", () => {
      const resources = performance.getEntriesByType(
        "resource"
      ) as PerformanceResourceTiming[];

      resources.forEach((resource) => {
        const duration = resource.responseEnd - resource.requestStart;

        // Track key bundle loading times
        if (resource.name.includes("/_next/static/chunks/")) {
          this.recordMetric(
            `Bundle-${resource.name.split("/").pop()}`,
            duration
          );
        }

        // Track API response times
        if (resource.name.includes("/api/")) {
          this.recordMetric(`API-${resource.name.split("/api/")[1]}`, duration);
        }
      });
    });
  }

  public trackVoicePerformance(metrics: VoicePerformanceMetrics) {
    this.voiceMetrics = { ...this.voiceMetrics, ...metrics };

    if (metrics.totalProcessingTime) {
      this.recordMetric("Voice-Total", metrics.totalProcessingTime);
    }
    if (metrics.transcriptionTime) {
      this.recordMetric("Voice-Transcription", metrics.transcriptionTime);
    }
    if (metrics.aiResponseTime) {
      this.recordMetric("Voice-AI", metrics.aiResponseTime);
    }

    console.log("Voice Performance:", metrics);
  }

  private sendToAnalytics(metric: PerformanceMetric) {
    // Send to analytics service (Google Analytics, DataDog, etc.)
    if (typeof window !== "undefined" && "gtag" in window) {
      (window as any).gtag("event", "performance_metric", {
        event_category: "Performance",
        event_label: metric.name,
        value: Math.round(metric.value),
        custom_map: { rating: metric.rating },
      });
    }

    // Send to console in development
    if (process.env.NODE_ENV === "development") {
      console.log(`Performance [${metric.name}]:`, {
        value: `${metric.value.toFixed(2)}ms`,
        rating: metric.rating,
      });
    }
  }

  public getMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values());
  }

  public getVoiceMetrics(): VoicePerformanceMetrics {
    return { ...this.voiceMetrics };
  }

  public generateReport(): string {
    const metrics = this.getMetrics();
    const voice = this.getVoiceMetrics();

    let report = "🚀 EMRsim-chat Performance Report\n\n";

    report += "📊 Core Web Vitals:\n";
    metrics.forEach((metric) => {
      const emoji =
        metric.rating === "good"
          ? "✅"
          : metric.rating === "needs-improvement"
          ? "⚠️"
          : "❌";
      report += `${emoji} ${metric.name}: ${metric.value.toFixed(2)}ms (${
        metric.rating
      })\n`;
    });

    if (Object.keys(voice).length > 0) {
      report += "\n🎤 Voice Performance:\n";
      if (voice.transcriptionTime)
        report += `⚡ Transcription: ${voice.transcriptionTime}ms\n`;
      if (voice.aiResponseTime)
        report += `🧠 AI Response: ${voice.aiResponseTime}ms\n`;
      if (voice.totalProcessingTime)
        report += `⏱️ Total: ${voice.totalProcessingTime}ms\n`;
      if (voice.cacheHitRate)
        report += `💾 Cache Hit Rate: ${voice.cacheHitRate.toFixed(1)}%\n`;
    }

    return report;
  }

  public destroy() {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
    this.metrics.clear();
  }
}

// Hook for React components
export function usePerformanceMonitor() {
  const monitor = PerformanceMonitor.getInstance();

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (typeof window !== "undefined") {
        monitor.destroy();
      }
    };
  }, [monitor]);

  return {
    trackVoicePerformance: monitor.trackVoicePerformance.bind(monitor),
    getMetrics: monitor.getMetrics.bind(monitor),
    getVoiceMetrics: monitor.getVoiceMetrics.bind(monitor),
    generateReport: monitor.generateReport.bind(monitor),
  };
}

export default PerformanceMonitor;
