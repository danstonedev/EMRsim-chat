/**
 * Transcript monitoring and telemetry utilities
 *
 * Provides structured logging for transcript edge cases:
 * - Missing itemIds
 * - Slow transcription finalizations
 * - Catchup events
 * - Persistence failures
 * - Deduplication events
 */

interface TranscriptMetrics {
  missingItemIdCount: number;
  slowFinalizationCount: number;
  catchupEventCount: number;
  persistenceFailureCount: number;
  deduplicationCount: number;
  lastResetTime: number;
}

const metrics: TranscriptMetrics = {
  missingItemIdCount: 0,
  slowFinalizationCount: 0,
  catchupEventCount: 0,
  persistenceFailureCount: 0,
  deduplicationCount: 0,
  lastResetTime: Date.now(),
};

// Configuration
const SLOW_FINALIZATION_THRESHOLD_MS = 10000; // 10 seconds
const METRICS_RESET_INTERVAL_MS = 3600000; // 1 hour

/**
 * Log when OpenAI doesn't provide an itemId
 */
export function logMissingItemId(context: {
  sessionId?: string;
  role: 'user' | 'assistant';
  textLength: number;
  generatedId: string;
}) {
  metrics.missingItemIdCount++;

  console.warn('[TranscriptMonitor] Missing itemId from OpenAI:', {
    count: metrics.missingItemIdCount,
    sessionId: context.sessionId?.slice(-6),
    role: context.role,
    textLength: context.textLength,
    generatedFallback: context.generatedId.slice(0, 20) + '...',
    recommendation: 'Monitor for OpenAI API changes or reliability issues',
  });
}

/**
 * Log when transcription takes unusually long to finalize
 */
export function logSlowFinalization(context: {
  sessionId?: string;
  role: 'user' | 'assistant';
  durationMs: number;
  textLength: number;
}) {
  if (context.durationMs < SLOW_FINALIZATION_THRESHOLD_MS) {
    return; // Not slow enough to log
  }

  metrics.slowFinalizationCount++;

  console.warn('[TranscriptMonitor] Slow transcription finalization:', {
    count: metrics.slowFinalizationCount,
    sessionId: context.sessionId?.slice(-6),
    role: context.role,
    durationMs: context.durationMs,
    durationSec: (context.durationMs / 1000).toFixed(1),
    textLength: context.textLength,
    threshold: SLOW_FINALIZATION_THRESHOLD_MS,
    possibleCauses: ['Network latency', 'OpenAI API throttling', 'Long audio buffer'],
  });
}

/**
 * Log catchup event (socket reconnection replay)
 */
export function logCatchupEvent(context: {
  sessionId?: string;
  transcriptCount: number;
  oldestTimestamp?: number;
  newestTimestamp?: number;
}) {
  metrics.catchupEventCount++;

  const timeRange = context.oldestTimestamp && context.newestTimestamp
    ? `${((context.newestTimestamp - context.oldestTimestamp) / 1000).toFixed(1)}s`
    : 'unknown';

  console.log('[TranscriptMonitor] Catchup event (socket reconnection):', {
    count: metrics.catchupEventCount,
    sessionId: context.sessionId?.slice(-6),
    transcriptCount: context.transcriptCount,
    timeRange,
    note: 'Using 30-second deduplication window for catchup messages',
  });
}

/**
 * Log persistence failure (broadcast succeeded but DB failed)
 */
export function logPersistenceFailure(context: {
  sessionId?: string;
  role: 'user' | 'assistant';
  textLength: number;
  error: unknown;
}) {
  metrics.persistenceFailureCount++;

  const errorMessage = context.error instanceof Error
    ? context.error.message
    : String(context.error);

  console.error('[TranscriptMonitor] Persistence failure (UI delivered, DB failed):', {
    count: metrics.persistenceFailureCount,
    sessionId: context.sessionId?.slice(-6),
    role: context.role,
    textLength: context.textLength,
    error: errorMessage,
    impact: 'Message shown to user but not saved for transcript export',
    recommendation: 'Check database connection and disk space',
  });
}

/**
 * Log successful deduplication (caught a duplicate)
 */
export function logDeduplication(context: {
  sessionId?: string;
  role: 'user' | 'assistant';
  text: string;
  source: 'live' | 'catchup';
  dedupeMethod: 'itemId' | 'text+timestamp' | 'lastFinal' | 'existingMessage';
  windowMs?: number;
}) {
  metrics.deduplicationCount++;

  // Only log every 10th deduplication to avoid spam
  if (metrics.deduplicationCount % 10 === 0) {
    console.debug('[TranscriptMonitor] Deduplication active (showing every 10th):', {
      totalCount: metrics.deduplicationCount,
      sessionId: context.sessionId?.slice(-6),
      role: context.role,
      textPreview: context.text.slice(0, 50),
      source: context.source,
      method: context.dedupeMethod,
      windowMs: context.windowMs,
    });
  }
}

/**
 * Get current metrics snapshot
 */
export function getMetrics(): Readonly<TranscriptMetrics> {
  return { ...metrics };
}

/**
 * Reset metrics (useful for periodic reporting)
 */
export function resetMetrics() {
  metrics.missingItemIdCount = 0;
  metrics.slowFinalizationCount = 0;
  metrics.catchupEventCount = 0;
  metrics.persistenceFailureCount = 0;
  metrics.deduplicationCount = 0;
  metrics.lastResetTime = Date.now();
}

/**
 * Log metrics summary (call periodically)
 */
export function logMetricsSummary() {
  const uptimeMs = Date.now() - metrics.lastResetTime;
  const uptimeMin = (uptimeMs / 60000).toFixed(1);

  console.log('[TranscriptMonitor] Metrics Summary:', {
    uptimeMinutes: uptimeMin,
    missingItemIds: metrics.missingItemIdCount,
    slowFinalizations: metrics.slowFinalizationCount,
    catchupEvents: metrics.catchupEventCount,
    persistenceFailures: metrics.persistenceFailureCount,
    deduplications: metrics.deduplicationCount,
    healthStatus:
      metrics.persistenceFailureCount === 0 && metrics.missingItemIdCount < 5
        ? 'Healthy'
        : 'Review recommended',
  });
}

// Auto-reset metrics every hour
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    logMetricsSummary();
    resetMetrics();
  }, METRICS_RESET_INTERVAL_MS);
}

export default {
  logMissingItemId,
  logSlowFinalization,
  logCatchupEvent,
  logPersistenceFailure,
  logDeduplication,
  getMetrics,
  resetMetrics,
  logMetricsSummary,
};
