// Performance optimization utilities for the chat interface
import { useCallback, useRef, useEffect } from "react";

// Request deduplication utility
export class RequestDeduplicator {
  private pending = new Map<string, Promise<any>>();

  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (this.pending.has(key)) {
      return this.pending.get(key) as Promise<T>;
    }

    const promise = fn().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise;
  }

  clear() {
    this.pending.clear();
  }
}

// Audio context pool to prevent multiple contexts
export class AudioContextPool {
  private static instance: AudioContextPool;
  private contexts: AudioContext[] = [];
  private maxContexts = 2;

  static getInstance(): AudioContextPool {
    if (!AudioContextPool.instance) {
      AudioContextPool.instance = new AudioContextPool();
    }
    return AudioContextPool.instance;
  }

  getContext(): AudioContext | null {
    // Reuse existing context if available
    const existing = this.contexts.find((ctx) => ctx.state !== "closed");
    if (existing) return existing;

    // Create new context if under limit
    if (this.contexts.length < this.maxContexts) {
      try {
        const ctx = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
        this.contexts.push(ctx);
        return ctx;
      } catch (error) {
        console.warn("Failed to create AudioContext:", error);
        return null;
      }
    }

    return null;
  }

  releaseContext(context: AudioContext) {
    try {
      context.close();
    } catch (error) {
      console.warn("Failed to close AudioContext:", error);
    }
  }

  cleanup() {
    this.contexts.forEach((ctx) => {
      try {
        ctx.close();
      } catch {}
    });
    this.contexts = [];
  }
}

// Efficient message batching for UI updates
export class MessageBatcher {
  private batch: any[] = [];
  private timeout: number | null = null;
  private readonly delay: number;

  constructor(delay = 16) {
    // ~60fps
    this.delay = delay;
  }

  add(item: any, callback: (batch: any[]) => void) {
    this.batch.push(item);

    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    this.timeout = window.setTimeout(() => {
      const currentBatch = [...this.batch];
      this.batch = [];
      this.timeout = null;
      callback(currentBatch);
    }, this.delay);
  }

  flush(callback: (batch: any[]) => void) {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (this.batch.length > 0) {
      const currentBatch = [...this.batch];
      this.batch = [];
      callback(currentBatch);
    }
  }

  clear() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    this.batch = [];
  }
}

// Memory-efficient LRU cache for audio/TTS
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize = 50) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        const oldValue = this.cache.get(firstKey);
        this.cache.delete(firstKey);

        // Cleanup if value has cleanup method
        if (oldValue && typeof (oldValue as any).cleanup === "function") {
          try {
            (oldValue as any).cleanup();
          } catch {}
        }
      }
    }

    this.cache.set(key, value);
  }

  clear(): void {
    // Cleanup all values if they have cleanup methods
    for (const value of this.cache.values()) {
      if (typeof (value as any).cleanup === "function") {
        try {
          (value as any).cleanup();
        } catch {}
      }
    }
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Optimized event throttling
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCall = useRef<number>(0);
  const timeoutRef = useRef<number | null>(null);

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCall.current;

      if (timeSinceLastCall >= delay) {
        lastCall.current = now;
        callback(...args);
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = window.setTimeout(() => {
          lastCall.current = Date.now();
          callback(...args);
        }, delay - timeSinceLastCall);
      }
    },
    [callback, delay]
  ) as T;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledCallback;
}

// Performance monitoring utility
export class PerformanceMonitor {
  private measurements = new Map<string, number[]>();
  private maxSamples = 100;

  start(label: string): () => void {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      this.record(label, duration);
    };
  }

  record(label: string, duration: number) {
    if (!this.measurements.has(label)) {
      this.measurements.set(label, []);
    }

    const samples = this.measurements.get(label)!;
    samples.push(duration);

    // Keep only recent samples
    if (samples.length > this.maxSamples) {
      samples.shift();
    }
  }

  getStats(label: string) {
    const samples = this.measurements.get(label) || [];
    if (samples.length === 0) return null;

    const sum = samples.reduce((a, b) => a + b, 0);
    const avg = sum / samples.length;
    const min = Math.min(...samples);
    const max = Math.max(...samples);

    return { avg, min, max, count: samples.length };
  }

  getAllStats() {
    const stats: Record<string, any> = {};
    for (const [label] of this.measurements) {
      stats[label] = this.getStats(label);
    }
    return stats;
  }

  clear() {
    this.measurements.clear();
  }
}

// Global performance monitor instance
export const perfMonitor = new PerformanceMonitor();

// Echo detection utility for conversation mode
export function isLikelyEcho(
  transcribedText: string,
  lastReply: string
): boolean {
  if (!transcribedText || !lastReply) return false;

  const normalized1 = transcribedText.toLowerCase().trim();
  const normalized2 = lastReply.toLowerCase().trim();

  // Simple similarity check
  if (normalized1.length < 10) return false;

  // Check for substring match (indicating echo)
  const similarity =
    normalized1.includes(normalized2.slice(0, 20)) ||
    normalized2.includes(normalized1.slice(0, 20));

  return similarity;
}

// Non-speech detection utility
export function isLikelyNonSpeech(text: string): boolean {
  if (!text || text.trim().length < 2) return true;

  const normalized = text.toLowerCase().trim();

  // Common mishears to filter out
  const nonSpeechPatterns = [
    "um",
    "uh",
    "ah",
    "eh",
    "mhm",
    "hmm",
    "you",
    "the",
    "a",
    "an",
    "and",
    "...",
    "..",
    ".",
    "music",
    "sound",
  ];

  return nonSpeechPatterns.includes(normalized) || normalized.length < 3;
}

export default {
  RequestDeduplicator,
  AudioContextPool,
  MessageBatcher,
  LRUCache,
  useThrottledCallback,
  PerformanceMonitor,
  perfMonitor,
  isLikelyEcho,
  isLikelyNonSpeech,
};
