import { Request, Response, NextFunction } from 'express';

/**
 * Performance metrics storage
 */
interface PerformanceMetrics {
  requests: {
    total: number;
    byStatus: Record<number, number>;
    byMethod: Record<string, number>;
    byRoute: Record<string, number>;
  };
  responseTime: {
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    samples: number[];
  };
  errors: {
    total: number;
    rate: number;
  };
  uptime: number;
}

const metrics: PerformanceMetrics = {
  requests: {
    total: 0,
    byStatus: {},
    byMethod: {},
    byRoute: {},
  },
  responseTime: {
    min: Infinity,
    max: 0,
    avg: 0,
    p50: 0,
    p95: 0,
    p99: 0,
    samples: [],
  },
  errors: {
    total: 0,
    rate: 0,
  },
  uptime: Date.now(),
};

// Keep only last 1000 samples for percentile calculations
const MAX_SAMPLES = 1000;

/**
 * Calculate percentile from sorted array
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((sorted.length * p) / 100) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Update response time metrics
 */
function updateResponseTimeMetrics(duration: number): void {
  metrics.responseTime.min = Math.min(metrics.responseTime.min, duration);
  metrics.responseTime.max = Math.max(metrics.responseTime.max, duration);
  
  metrics.responseTime.samples.push(duration);
  
  // Keep only last MAX_SAMPLES
  if (metrics.responseTime.samples.length > MAX_SAMPLES) {
    metrics.responseTime.samples.shift();
  }
  
  // Calculate average
  const sum = metrics.responseTime.samples.reduce((a, b) => a + b, 0);
  metrics.responseTime.avg = sum / metrics.responseTime.samples.length;
  
  // Calculate percentiles
  const sorted = [...metrics.responseTime.samples].sort((a, b) => a - b);
  metrics.responseTime.p50 = percentile(sorted, 50);
  metrics.responseTime.p95 = percentile(sorted, 95);
  metrics.responseTime.p99 = percentile(sorted, 99);
}

/**
 * Express middleware to track performance metrics
 */
export const performanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = process.hrtime.bigint();
  
  // Track request
  metrics.requests.total++;
  metrics.requests.byMethod[req.method] = (metrics.requests.byMethod[req.method] || 0) + 1;
  
  // Extract route pattern (remove IDs)
  const route = req.route?.path || req.path.replace(/\/[0-9a-f-]{36}/gi, '/:id');
  metrics.requests.byRoute[route] = (metrics.requests.byRoute[route] || 0) + 1;
  
  // Track response
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
    
    // Update metrics
    metrics.requests.byStatus[res.statusCode] = (metrics.requests.byStatus[res.statusCode] || 0) + 1;
    
    if (res.statusCode >= 500) {
      metrics.errors.total++;
    }
    
    updateResponseTimeMetrics(duration);
    
    // Calculate error rate
    metrics.errors.rate = (metrics.errors.total / metrics.requests.total) * 100;
  });
  
  next();
};

/**
 * Get current metrics snapshot
 */
export function getMetrics(): PerformanceMetrics {
  return {
    ...metrics,
    uptime: Date.now() - metrics.uptime,
    responseTime: {
      ...metrics.responseTime,
      // Don't expose raw samples in metrics endpoint
      samples: [],
    },
  };
}

/**
 * Reset metrics (useful for testing)
 */
export function resetMetrics(): void {
  metrics.requests.total = 0;
  metrics.requests.byStatus = {};
  metrics.requests.byMethod = {};
  metrics.requests.byRoute = {};
  metrics.responseTime.min = Infinity;
  metrics.responseTime.max = 0;
  metrics.responseTime.avg = 0;
  metrics.responseTime.p50 = 0;
  metrics.responseTime.p95 = 0;
  metrics.responseTime.p99 = 0;
  metrics.responseTime.samples = [];
  metrics.errors.total = 0;
  metrics.errors.rate = 0;
  metrics.uptime = Date.now();
}

/**
 * Get Prometheus-compatible metrics format
 */
export function getPrometheusMetrics(): string {
  const lines: string[] = [];
  
  // Request count
  lines.push('# HELP http_requests_total Total number of HTTP requests');
  lines.push('# TYPE http_requests_total counter');
  lines.push(`http_requests_total ${metrics.requests.total}`);
  
  // Requests by method
  lines.push('# HELP http_requests_by_method_total HTTP requests by method');
  lines.push('# TYPE http_requests_by_method_total counter');
  Object.entries(metrics.requests.byMethod).forEach(([method, count]) => {
    lines.push(`http_requests_by_method_total{method="${method}"} ${count}`);
  });
  
  // Requests by status
  lines.push('# HELP http_requests_by_status_total HTTP requests by status code');
  lines.push('# TYPE http_requests_by_status_total counter');
  Object.entries(metrics.requests.byStatus).forEach(([status, count]) => {
    lines.push(`http_requests_by_status_total{status="${status}"} ${count}`);
  });
  
  // Response time
  lines.push('# HELP http_response_time_milliseconds HTTP response time in milliseconds');
  lines.push('# TYPE http_response_time_milliseconds summary');
  lines.push(`http_response_time_milliseconds{quantile="0.5"} ${metrics.responseTime.p50}`);
  lines.push(`http_response_time_milliseconds{quantile="0.95"} ${metrics.responseTime.p95}`);
  lines.push(`http_response_time_milliseconds{quantile="0.99"} ${metrics.responseTime.p99}`);
  lines.push(`http_response_time_milliseconds_sum ${metrics.responseTime.avg * metrics.requests.total}`);
  lines.push(`http_response_time_milliseconds_count ${metrics.requests.total}`);
  
  // Errors
  lines.push('# HELP http_errors_total Total number of HTTP errors (5xx)');
  lines.push('# TYPE http_errors_total counter');
  lines.push(`http_errors_total ${metrics.errors.total}`);
  
  // Error rate
  lines.push('# HELP http_error_rate_percent HTTP error rate percentage');
  lines.push('# TYPE http_error_rate_percent gauge');
  lines.push(`http_error_rate_percent ${metrics.errors.rate}`);
  
  // Uptime
  lines.push('# HELP process_uptime_milliseconds Process uptime in milliseconds');
  lines.push('# TYPE process_uptime_milliseconds counter');
  lines.push(`process_uptime_milliseconds ${Date.now() - metrics.uptime}`);
  
  return lines.join('\n') + '\n';
}
