/**
 * Centralized error logging service for EMRsim-chat
 * Handles error logging, aggregation, and reporting to backend
 */

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

interface ErrorLogOptions {
  severity?: ErrorSeverity;
  context?: Record<string, any>;
  tags?: string[];
  user?: string;
}

interface ErrorLogEntry {
  message: string;
  stack?: string;
  timestamp: string;
  severity: ErrorSeverity;
  context: Record<string, any>;
  tags: string[];
  user?: string;
  sessionId: string;
  url: string;
  userAgent: string;
}

/**
 * Centralized error logger that handles capturing and reporting errors
 */
class ErrorLogger {
  private static instance: ErrorLogger;
  private sessionId: string;
  private logsBuffer: ErrorLogEntry[] = [];
  private flushInterval: number | null = null;
  private maxBufferSize = 10;
  private isInitialized = false;
  
  private constructor() {
    this.sessionId = this.generateSessionId();
  }

  /**
   * Get the singleton instance of ErrorLogger
   */
  public static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  /**
   * Initialize the error logger with configuration
   */
  public init(options: { flushIntervalMs?: number; maxBufferSize?: number } = {}): void {
    if (this.isInitialized) return;
    
    const { flushIntervalMs = 30000, maxBufferSize = 10 } = options;
    
    this.maxBufferSize = maxBufferSize;
    
    // Set up automatic flushing of logs
    this.flushInterval = window.setInterval(() => {
      this.flush();
    }, flushIntervalMs);
    
    // Listen for unhandled errors
    window.addEventListener('error', this.handleWindowError);
    window.addEventListener('unhandledrejection', this.handlePromiseRejection);
    
    // Flush logs before page unloads
    window.addEventListener('beforeunload', () => {
      this.flush(true);
    });
    
    this.isInitialized = true;
  }

  /**
   * Clean up event listeners
   */
  public destroy(): void {
    if (this.flushInterval !== null) {
      clearInterval(this.flushInterval);
    }
    
    window.removeEventListener('error', this.handleWindowError);
    window.removeEventListener('unhandledrejection', this.handlePromiseRejection);
    
    this.isInitialized = false;
  }

  /**
   * Log an error with optional metadata
   */
  public logError(error: Error | string, options: ErrorLogOptions = {}): void {
    const {
      severity = ErrorSeverity.MEDIUM,
      context = {},
      tags = [],
      user,
    } = options;
    
    const errorEntry: ErrorLogEntry = {
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error !== 'string' ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      severity,
      context,
      tags,
      user,
      sessionId: this.sessionId,
      url: window.location.href,
      userAgent: navigator.userAgent,
    };
    
    // Add to buffer
    this.logsBuffer.push(errorEntry);
    
    // Auto flush if buffer exceeds max size
    if (this.logsBuffer.length >= this.maxBufferSize) {
      this.flush();
    }
    
    // Also log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ErrorLogger]', errorEntry);
    }
  }

  /**
   * Flush all buffered logs to the server
   */
  public async flush(sync: boolean = false): Promise<void> {
    if (this.logsBuffer.length === 0) return;
    
    const logsToSend = [...this.logsBuffer];
    this.logsBuffer = [];
    
    try {
      const sendLogs = () => 
        fetch('/api/logs/error', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logs: logsToSend }),
        });
      
      if (sync) {
        // Use navigator.sendBeacon for sync flush during page unload
        const blob = new Blob(
          [JSON.stringify({ logs: logsToSend })],
          { type: 'application/json' }
        );
        navigator.sendBeacon('/api/logs/error', blob);
      } else {
        // Use standard fetch for async flush
        await sendLogs();
      }
    } catch (err) {
      console.error('Failed to send error logs', err);
      
      // Put logs back in buffer
      this.logsBuffer = [...logsToSend, ...this.logsBuffer];
      
      // Ensure buffer doesn't grow too large
      if (this.logsBuffer.length > this.maxBufferSize * 2) {
        this.logsBuffer = this.logsBuffer.slice(-this.maxBufferSize);
      }
    }
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = (Math.random() * 16) | 0,
        v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Handle window error events
   */
  private handleWindowError = (event: ErrorEvent): void => {
    this.logError(event.error || new Error(event.message), {
      severity: ErrorSeverity.HIGH,
      context: {
        lineNo: event.lineno,
        colNo: event.colno,
        filename: event.filename,
      },
      tags: ['unhandled', 'window-error'],
    });
  };

  /**
   * Handle unhandled promise rejections
   */
  private handlePromiseRejection = (event: PromiseRejectionEvent): void => {
    const error = event.reason instanceof Error 
      ? event.reason 
      : new Error(String(event.reason));
    
    this.logError(error, {
      severity: ErrorSeverity.HIGH,
      context: {
        reason: event.reason,
      },
      tags: ['unhandled', 'promise-rejection'],
    });
  };
}

// Export a singleton instance
export const errorLogger = ErrorLogger.getInstance();

/**
 * Hook to use error logging in components
 */
export function logError(
  error: Error | string,
  options: ErrorLogOptions = {}
): void {
  errorLogger.logError(error, options);
}

/**
 * Utility to create error boundaries with logging
 */
export function withErrorLogging<P>(Component: React.ComponentType<P>): React.FC<P> {
  return function WithErrorLogging(props: P) {
    try {
      return <Component {...props} />;
    } catch (error) {
      errorLogger.logError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  };
}
