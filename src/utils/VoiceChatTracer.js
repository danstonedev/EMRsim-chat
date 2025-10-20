/**
 * Debugging utility for tracing voice-to-chat flow
 * Helps identify bottlenecks and issues in the pipeline
 */
export class VoiceChatTracer {
  constructor(options = {}) {
    this.sessionId = options.sessionId || `session-${Date.now()}`;
    this.startTime = Date.now();
    this.events = [];
    this.enabled = options.enabled !== false;
    this.consoleLogging = options.consoleLogging !== false;
    this.remoteLogging = options.remoteLogging === true;
    this.maxEvents = options.maxEvents || 1000;
  }
  
  /**
   * Record a trace event in the pipeline
   */
  trace(step, details = {}) {
    if (!this.enabled) return;
    
    const timestamp = Date.now();
    const elapsed = timestamp - this.startTime;
    
    const event = {
      step,
      timestamp,
      elapsed,
      details
    };
    
    // Add to event buffer (with size limit)
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
    
    // Console logging
    if (this.consoleLogging) {
      console.log(`[Trace:${this.sessionId}] ${step} +${elapsed}ms`, details);
    }
    
    // Remote logging
    if (this.remoteLogging && window.monitoring) {
      window.monitoring.trackEvent(`voice-chat:${step}`, {
        sessionId: this.sessionId,
        elapsed,
        ...details
      });
    }
    
    return elapsed;
  }
  
  /**
   * Get all recorded events
   */
  getEvents() {
    return [...this.events];
  }
  
  /**
   * Get duration since tracer was started
   */
  getDuration() {
    return Date.now() - this.startTime;
  }
  
  /**
   * Get latency between two steps
   */
  getLatency(startStep, endStep) {
    const startEvent = this.events.find(e => e.step === startStep);
    const endEvent = this.events.find(e => e.step === endStep);
    
    if (!startEvent || !endEvent) {
      return null;
    }
    
    return endEvent.elapsed - startEvent.elapsed;
  }
  
  /**
   * Create a visual timeline of events
   */
  visualize() {
    if (this.events.length === 0) {
      return 'No events recorded';
    }
    
    // Create ASCII timeline visualization
    return this.events.map(event => {
      const bar = '='.repeat(Math.max(1, Math.floor(event.elapsed / 100)));
      return `${event.elapsed.toString().padStart(5)}ms [${bar}] ${event.step}`;
    }).join('\n');
  }
  
  /**
   * Export all tracing data for saving/analysis
   */
  export() {
    return {
      sessionId: this.sessionId,
      startTime: this.startTime,
      endTime: Date.now(),
      duration: this.getDuration(),
      eventCount: this.events.length,
      events: this.events
    };
  }
  
  /**
   * Reset the tracer
   */
  reset() {
    this.events = [];
    this.startTime = Date.now();
  }
}

/**
 * Create a tracer instance for the current session
 */
export function createVoiceChatTracer(sessionId, options = {}) {
  return new VoiceChatTracer({
    sessionId,
    enabled: process.env.NODE_ENV !== 'production' || options.enabledInProduction,
    consoleLogging: process.env.NODE_ENV !== 'production',
    remoteLogging: process.env.NODE_ENV === 'production',
    ...options
  });
}
