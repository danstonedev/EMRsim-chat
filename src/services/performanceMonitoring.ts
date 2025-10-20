/**
 * Performance monitoring service for tracking application performance metrics
 */

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  tags: Record<string, string>;
}

interface PageLoadMetrics {
  ttfb: number;            // Time to First Byte
  fcp: number;             // First Contentful Paint
  lcp: number | null;      // Largest Contentful Paint
  fid: number | null;      // First Input Delay
  cls: number | null;      // Cumulative Layout Shift
  navigationStart: number; // Navigation start timestamp
  loadEventEnd: number;    // Load event end timestamp
}

interface PerformanceMonitorOptions {
  sampleRate?: number;     // Rate at which to sample performance data (0-1)
  reportingInterval?: number; // How often to report metrics (ms)
  apiEndpoint?: string;    // API endpoint for sending metrics
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metricsBuffer: PerformanceMetric[] = [];
  private options: Required<PerformanceMonitorOptions>;
  private reportingInterval: number | null = null;
  private isInitialized = false;
  private lcpObserver: PerformanceObserver | null = null;
  private fidObserver: PerformanceObserver | null = null;
  private layoutShiftObserver: PerformanceObserver | null = null;
  
  private defaultOptions: Required<PerformanceMonitorOptions> = {
    sampleRate: 0.1,       // Sample 10% of sessions by default
    reportingInterval: 60000, // Report every 60 seconds
    apiEndpoint: '/api/metrics/performance'
  };

  private constructor() {
    this.options = { ...this.defaultOptions };
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Initialize the performance monitor
   */
  public init(options: PerformanceMonitorOptions = {}): void {
    if (this.isInitialized) return;
    
    this.options = { ...this.defaultOptions, ...options };
    
    // Only monitor a percentage of sessions based on sample rate
    const shouldMonitor = Math.random() <= this.options.sampleRate;
    if (!shouldMonitor) return;
    
    // Set up performance observers
    this.setupPerformanceObservers();
    
    // Collect page load metrics when the page finishes loading
    window.addEventListener('load', () => {
      setTimeout(() => {
        this.collectPageLoadMetrics();
      }, 1000);
    });
    
    // Set up automatic reporting interval
    this.reportingInterval = window.setInterval(() => {
      this.reportMetrics();
    }, this.options.reportingInterval);
    
    // Send metrics before page unload
    window.addEventListener('beforeunload', () => {
      this.reportMetrics(true);
    });
    
    this.isInitialized = true;
  }

  /**
   * Clean up observers and intervals
   */
  public destroy(): void {
    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
    }
    
    if (this.lcpObserver) {
      this.lcpObserver.disconnect();
    }
    
    if (this.fidObserver) {
      this.fidObserver.disconnect();
    }
    
    if (this.layoutShiftObserver) {
      this.layoutShiftObserver.disconnect();
    }
    
    this.isInitialized = false;
  }

  /**
   * Track a custom performance metric
   */
  public trackMetric(name: string, value: number, tags: Record<string, string> = {}): void {
    if (!this.isInitialized) return;
    
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      tags: {
        ...tags,
        page: window.location.pathname
      }
    };
    
    this.metricsBuffer.push(metric);
  }

  /**
   * Track API call performance
   */
  public trackApiCall(
    endpoint: string, 
    method: string, 
    duration: number, 
    status: number
  ): void {
    this.trackMetric('api_call', duration, {
      endpoint,
      method,
      status: status.toString()
    });
  }

  /**
   * Track component render time
   */
  public trackRenderTime(
    componentName: string,
    duration: number
  ): void {
    this.trackMetric('component_render', duration, {
      component: componentName
    });
  }

  /**
   * Set up performance observers for web vitals
   */
  private setupPerformanceObservers(): void {
    // Observe Largest Contentful Paint
    if (PerformanceObserver.supportedEntryTypes.includes('largest-contentful-paint')) {
      this.lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          this.trackMetric('largest_contentful_paint', lastEntry.startTime, {
            type: 'web_vital'
          });
        }
      });
      
      this.lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    }
    
    // Observe First Input Delay
    if (PerformanceObserver.supportedEntryTypes.includes('first-input')) {
      this.fidObserver = new PerformanceObserver((entryList) => {
        const firstInput = entryList.getEntries()[0];
        if (firstInput) {
          const processingStart = firstInput.processingStart || 0;
          const startTime = firstInput.startTime || 0;
          const inputDelay = processingStart - startTime;
          
          this.trackMetric('first_input_delay', inputDelay, {
            type: 'web_vital'
          });
        }
      });
      
      this.fidObserver.observe({ type: 'first-input', buffered: true });
    }
    
    // Observe Layout Shifts
    if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) {
      let clsValue = 0;
      
      this.layoutShiftObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries() as PerformanceEntry[]) {
          // Only count layout shifts without recent user input
          // @ts-ignore - value exists on layout shift entries
          if (!(entry as any).hadRecentInput) {
            // @ts-ignore - value exists on layout shift entries
            clsValue += (entry as any).value;
          }
        }
        
        this.trackMetric('cumulative_layout_shift', clsValue, {
          type: 'web_vital'
        });
      });
      
      this.layoutShiftObserver.observe({ type: 'layout-shift', buffered: false });
    }
  }

  /**
   * Collect page load metrics using Navigation Timing API
   */
  private collectPageLoadMetrics(): void {
    if (!performance || !performance.timing) return;
    
    const timing = performance.timing;
    
    const metrics: PageLoadMetrics = {
      ttfb: timing.responseStart - timing.requestStart,
      fcp: this.getFCP(),
      lcp: null, // Will be collected by observer
      fid: null, // Will be collected by observer
      cls: null, // Will be collected by observer
      navigationStart: timing.navigationStart,
      loadEventEnd: timing.loadEventEnd
    };
    
    // Track total page load time
    this.trackMetric('page_load_time', timing.loadEventEnd - timing.navigationStart, {
      type: 'navigation'
    });
    
    // Track Time to First Byte
    this.trackMetric('ttfb', metrics.ttfb, {
      type: 'navigation'
    });
    
    // Track First Contentful Paint if available
    if (metrics.fcp > 0) {
      this.trackMetric('first_contentful_paint', metrics.fcp, {
        type: 'web_vital'
      });
    }
  }

  /**
   * Get First Contentful Paint metric
   */
  private getFCP(): number {
    let fcp = 0;
    
    if (window.performance && performance.getEntriesByType) {
      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
      
      if (fcpEntry) {
        fcp = fcpEntry.startTime;
      }
    }
    
    return fcp;
  }

  /**
   * Report collected metrics to the server
   */
  private async reportMetrics(sync: boolean = false): Promise<void> {
    if (this.metricsBuffer.length === 0) return;
    
    const metricsToSend = [...this.metricsBuffer];
    this.metricsBuffer = [];
    
    try {
      if (sync) {
        // Use navigator.sendBeacon for sync reporting
        const blob = new Blob(
          [JSON.stringify({ metrics: metricsToSend })],
          { type: 'application/json' }
        );
        
        navigator.sendBeacon(this.options.apiEndpoint, blob);
      } else {
        // Use fetch for async reporting
        await fetch(this.options.apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metrics: metricsToSend })
        });
      }
    } catch (err) {
      console.error('Failed to report performance metrics', err);
      
      // Return metrics to the buffer
      this.metricsBuffer = [...metricsToSend, ...this.metricsBuffer];
    }
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

/**
 * React hook for measuring component render time
 */
export function usePerformanceTracking(componentName: string) {
  return {
    trackRender: (startTime: number) => {
      const renderTime = performance.now() - startTime;
      performanceMonitor.trackRenderTime(componentName, renderTime);
    }
  };
}

/**
 * Higher-order component to track render performance
 */
export function withPerformanceTracking<P>(
  Component: React.ComponentType<P>,
  componentName: string
): React.FC<P> {
  return function WithPerformanceTracking(props: P) {
    const startTime = performance.now();
    
    React.useEffect(() => {
      const renderTime = performance.now() - startTime;
      performanceMonitor.trackRenderTime(componentName, renderTime);
    }, []);
    
    return <Component {...props} />;
  };
}
