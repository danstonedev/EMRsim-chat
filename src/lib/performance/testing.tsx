// Performance testing and measurement utilities
import { perfMonitor } from './optimizations';
import { useState, useEffect, useRef, useCallback } from 'react';

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
    if (typeof window !== 'undefined' && window.performance) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        // Use fetchStart instead of deprecated navigationStart
        this.metrics.initialLoad = navigation.loadEventEnd - navigation.fetchStart;
        this.metrics.firstContentfulPaint = this.getFCP();
      }
    }
  }

  // Get First Contentful Paint
  private getFCP(): number {
    const paintEntries = performance.getEntriesByType('paint');
    const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    return fcp ? fcp.startTime : 0;
  }

  // Measure memory usage
  private measureMemoryUsage() {
    if (typeof window !== 'undefined' && (window.performance as any).memory) {
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
      case 'chat-response':
        this.metrics.chatResponseTime = duration;
        break;
      case 'conversation-loop':
        this.metrics.conversationLatency = duration;
        break;
      case 'audio-processing':
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
        improvement: ((baseline.initialLoad - current.initialLoad) / baseline.initialLoad) * 100,
      },
      chatResponseTime: {
        current: current.chatResponseTime,
        baseline: baseline.chatResponseTime,
        improvement: ((baseline.chatResponseTime - current.chatResponseTime) / baseline.chatResponseTime) * 100,
      },
      conversationLatency: {
        current: current.conversationLatency,
        baseline: baseline.conversationLatency,
        improvement: ((baseline.conversationLatency - current.conversationLatency) / baseline.conversationLatency) * 100,
      },
      memoryUsage: {
        current: current.memoryUsage,
        baseline: baseline.memoryUsage,
        improvement: ((baseline.memoryUsage - current.memoryUsage) / baseline.memoryUsage) * 100,
      },
      renderCount: {
        current: current.renderCount,
        baseline: baseline.renderCount,
        improvement: ((baseline.renderCount - current.renderCount) / baseline.renderCount) * 100,
      }
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
      recommendations.push('Consider implementing response caching or optimizing API calls');
    }
    
    if (metrics.memoryUsage > 50) {
      recommendations.push('Memory usage is high - check for memory leaks in audio processing');
    }
    
    if (metrics.renderCount > 50) {
      recommendations.push('High render count detected - consider memoizing components');
    }

    if (metrics.conversationLatency > 800) {
      recommendations.push('Conversation latency is high - optimize audio processing pipeline');
    }

    return recommendations;
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

// React hook for performance tracking
export function usePerformanceTracking() {
  const testerRef = useRef<PerformanceTester | null>(null);
  
  if (!testerRef.current) {
    testerRef.current = new PerformanceTester();
  }

  const trackRender = useCallback(() => {
    testerRef.current?.trackRender();
  }, []);

  const startTiming = useCallback((operation: string) => {
    testerRef.current?.startTiming(operation);
  }, []);

  const endTiming = useCallback((operation: string) => {
    return testerRef.current?.endTiming(operation) || 0;
  }, []);

  const getReport = useCallback(() => {
    return testerRef.current?.generateReport();
  }, []);

  return {
    trackRender,
    startTiming,
    endTiming,
    getReport,
    getMetrics: () => testerRef.current?.getMetrics(),
    getComparison: () => testerRef.current?.compareWithBaseline(),
  };
}

// Global performance tester instance
export const globalPerfTester = new PerformanceTester();

// Performance monitoring component
export function PerformanceMonitor({ showStats = false }: { showStats?: boolean }) {
  const [stats, setStats] = useState<PerformanceReport | null>(null);
  const [isVisible, setIsVisible] = useState(showStats);

  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setStats(globalPerfTester.generateReport());
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible || !stats) return null;

  return (
    <div className="performance-monitor">
      <div className="performance-header">
        <h3>Performance Monitor</h3>
        <button onClick={() => setIsVisible(false)}>×</button>
      </div>
      
      <div className="performance-metrics">
        <div className="metric">
          <span>Memory: {stats.metrics.memoryUsage?.toFixed(1)}MB</span>
        </div>
        <div className="metric">
          <span>Renders: {stats.metrics.renderCount}</span>
        </div>
        <div className="metric">
          <span>Chat Response: {stats.metrics.chatResponseTime?.toFixed(0)}ms</span>
        </div>
        <div className="metric">
          <span>Conversation: {stats.metrics.conversationLatency?.toFixed(0)}ms</span>
        </div>
      </div>

      <div className="performance-improvements">
        {Object.entries(stats.comparison).map(([key, data]) => (
          <div key={key} className="improvement">
            <span>{key}: </span>
            <span className={data.improvement > 0 ? 'positive' : 'negative'}>
              {data.improvement > 0 ? '↑' : '↓'} {Math.abs(data.improvement).toFixed(1)}%
            </span>
          </div>
        ))}
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
    </div>
  );
}

export default PerformanceTester;