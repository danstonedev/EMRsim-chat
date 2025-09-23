// Performance testing and measurement utilities (TypeScript only)
import { perfMonitor } from "./optimizations";

export interface PerformanceMetrics {
  initialLoad: number;
  firstContentfulPaint: number;
  chatResponseTime: number;
  conversationLatency: number;
  memoryUsage: number;
  bundleSize?: number;
  renderCount: number;
  audioProcessingTime: number;
}

export class PerformanceTester {
  private renderCount = 0;
  private startTimes = new Map<string, number>();
  private metrics: Partial<PerformanceMetrics> = {};

  constructor() {
    this.measureInitialLoad();
    this.measureMemoryUsage();
  }

  // Measure initial page load time
  private measureInitialLoad() {
    if (typeof window !== "undefined" && window.performance) {
      const navigation = performance.getEntriesByType(
        "navigation"
      )[0] as PerformanceNavigationTiming;
      if (navigation) {
        this.metrics.initialLoad =
          navigation.loadEventEnd - navigation.fetchStart;
        this.metrics.firstContentfulPaint = this.getFCP();
      }
    }
  }

  // Get First Contentful Paint
  private getFCP(): number {
    const paintEntries = performance.getEntriesByType("paint");
    const fcp = paintEntries.find(
      (entry) => entry.name === "first-contentful-paint"
    );
    return fcp ? fcp.startTime : 0;
  }

  // Measure memory usage
  measureMemoryUsage() {
    if (typeof window !== "undefined" && (window.performance as any).memory) {
      const memory = (window.performance as any).memory;
      this.metrics.memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // Convert to MB
    }
  }

  // Start timing an operation
  startTiming(operation: string) {
    this.startTimes.set(operation, performance.now());
  }

  // End timing and record result
  endTiming(operation: string): number {
    const startTime = this.startTimes.get(operation);
    if (!startTime) return 0;

    const duration = performance.now() - startTime;
    this.startTimes.delete(operation);

    // Record in performance monitor
    perfMonitor.record(operation, duration);

    // Update metrics
    switch (operation) {
      case "chat-response":
        this.metrics.chatResponseTime = duration;
        break;
      case "conversation-loop":
        this.metrics.conversationLatency = duration;
        break;
      case "audio-processing":
        this.metrics.audioProcessingTime = duration;
        break;
    }

    return duration;
  }

  // Track component renders
  trackRender() {
    this.renderCount++;
    this.metrics.renderCount = this.renderCount;
  }

  // Get current metrics
  getMetrics(): PerformanceMetrics {
    this.measureMemoryUsage(); // Update memory usage
    return this.metrics as PerformanceMetrics;
  }

  // Compare with baseline (pre-optimization metrics)
  compareWithBaseline(): PerformanceComparison {
    const current = this.getMetrics();
    const baseline: PerformanceMetrics = {
      initialLoad: 2500,
      firstContentfulPaint: 1800,
      chatResponseTime: 800,
      conversationLatency: 1500,
      memoryUsage: 45,
      renderCount: 100, // Estimated for 1 minute of usage
      audioProcessingTime: 50,
    };

    return {
      initialLoad: {
        current: current.initialLoad,
        baseline: baseline.initialLoad,
        improvement:
          ((baseline.initialLoad - current.initialLoad) /
            baseline.initialLoad) *
          100,
      },
      chatResponseTime: {
        current: current.chatResponseTime,
        baseline: baseline.chatResponseTime,
        improvement:
          ((baseline.chatResponseTime - current.chatResponseTime) /
            baseline.chatResponseTime) *
          100,
      },
      conversationLatency: {
        current: current.conversationLatency,
        baseline: baseline.conversationLatency,
        improvement:
          ((baseline.conversationLatency - current.conversationLatency) /
            baseline.conversationLatency) *
          100,
      },
      memoryUsage: {
        current: current.memoryUsage,
        baseline: baseline.memoryUsage,
        improvement:
          ((baseline.memoryUsage - current.memoryUsage) /
            baseline.memoryUsage) *
          100,
      },
      renderCount: {
        current: current.renderCount,
        baseline: baseline.renderCount,
        improvement:
          ((baseline.renderCount - current.renderCount) /
            baseline.renderCount) *
          100,
      },
    };
  }

  // Generate performance report
  generateReport(): PerformanceReport {
    const metrics = this.getMetrics();
    const comparison = this.compareWithBaseline();
    const perfStats = perfMonitor.getAllStats();

    return {
      timestamp: new Date().toISOString(),
      metrics,
      comparison,
      detailedStats: perfStats,
      recommendations: this.generateRecommendations(metrics),
    };
  }

  private generateRecommendations(metrics: PerformanceMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.chatResponseTime > 500) {
      recommendations.push(
        "Consider implementing response caching or optimizing API calls"
      );
    }

    if (metrics.memoryUsage > 50) {
      recommendations.push(
        "Memory usage is high - check for memory leaks in audio processing"
      );
    }

    if (metrics.renderCount > 50) {
      recommendations.push(
        "High render count detected - consider memoizing components"
      );
    }

    if (metrics.conversationLatency > 800) {
      recommendations.push(
        "Conversation latency is high - optimize audio processing pipeline"
      );
    }

    return recommendations;
  }

  // Console-based performance report
  logPerformanceReport() {
    const report = this.generateReport();

    console.group("🚀 Performance Report");
    console.log("📊 Current Metrics:", report.metrics);
    console.log("📈 Improvements vs Baseline:");

    Object.entries(report.comparison).forEach(([key, data]) => {
      const icon = data.improvement > 0 ? "✅" : "❌";
      const direction = data.improvement > 0 ? "faster" : "slower";
      console.log(
        `  ${icon} ${key}: ${Math.abs(data.improvement).toFixed(
          1
        )}% ${direction}`
      );
    });

    if (report.recommendations.length > 0) {
      console.log("💡 Recommendations:");
      report.recommendations.forEach((rec) => console.log(`  • ${rec}`));
    }

    console.log("🔍 Detailed Stats:", report.detailedStats);
    console.groupEnd();
  }
}

export interface PerformanceComparison {
  [key: string]: {
    current: number;
    baseline: number;
    improvement: number;
  };
}

export interface PerformanceReport {
  timestamp: string;
  metrics: PerformanceMetrics;
  comparison: PerformanceComparison;
  detailedStats: Record<string, any>;
  recommendations: string[];
}

// Global performance tester instance
export const globalPerfTester = new PerformanceTester();

// Console-based performance testing functions
export const performanceTests = {
  // Test chat response time
  testChatResponse: async (message: string = "Hello, how are you?") => {
    console.log("🧪 Testing chat response time...");
    globalPerfTester.startTiming("chat-response");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (response.ok) {
        const duration = globalPerfTester.endTiming("chat-response");
        console.log(`✅ Chat response: ${duration.toFixed(2)}ms`);
        return duration;
      }
    } catch (error) {
      console.error("❌ Chat response test failed:", error);
    }
    return null;
  },

  // Test memory usage over time
  testMemoryUsage: () => {
    console.log("🧪 Starting memory usage monitoring...");
    const measurements: number[] = [];

    const interval = setInterval(() => {
      globalPerfTester.measureMemoryUsage();
      const metrics = globalPerfTester.getMetrics();
      measurements.push(metrics.memoryUsage);
      console.log(`📊 Memory: ${metrics.memoryUsage.toFixed(2)}MB`);

      if (measurements.length >= 10) {
        clearInterval(interval);
        const avg = measurements.reduce((a, b) => a + b) / measurements.length;
        const max = Math.max(...measurements);
        console.log(
          `📈 Memory stats - Avg: ${avg.toFixed(2)}MB, Max: ${max.toFixed(2)}MB`
        );
      }
    }, 1000);

    return interval;
  },

  // Test render performance
  testRenderPerformance: (
    renderFunction: () => void,
    iterations: number = 100
  ) => {
    console.log("🧪 Testing render performance...");

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      globalPerfTester.trackRender();
      renderFunction();
    }
    const duration = performance.now() - start;

    console.log(
      `✅ ${iterations} renders in ${duration.toFixed(2)}ms (${(
        duration / iterations
      ).toFixed(2)}ms per render)`
    );
    return duration;
  },

  // Generate full performance report
  generateFullReport: () => {
    globalPerfTester.logPerformanceReport();
    return globalPerfTester.generateReport();
  },
};

export default PerformanceTester;
