import type { ProfilerOnRenderCallback } from 'react'

const LOG_INTERVAL_MS = 5000
const LOG_DELAY_MS = 750

export type ComponentRenderMetrics = {
  commits: number
  totalActual: number
  totalBase: number
  maxActual: number
  maxBase: number
}

const metrics = new Map<string, ComponentRenderMetrics>()

let override: boolean | null = null
let logTimer: number | null = null
let lastLogTime = 0

const truthy = new Set(['1', 'true', 'yes', 'on', 'enable', 'enabled'])
const falsy = new Set(['0', 'false', 'no', 'off', 'disable', 'disabled'])

const parseBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toLowerCase()
  if (truthy.has(normalized)) return true
  if (falsy.has(normalized)) return false
  return fallback
}

const readEnvFlag = (): boolean => {
  const meta = (import.meta as any)?.env
  if (meta && typeof meta === 'object' && 'VITE_RENDER_METRICS' in meta) {
    return parseBoolean((meta as Record<string, unknown>).VITE_RENDER_METRICS, false)
  }
  return false
}

export const renderMetricsEnabled = (): boolean => {
  if (override !== null) {
    return override
  }
  if (typeof window !== 'undefined') {
    const runtime = (window as any).__SPS_RENDER_METRICS__
    if (typeof runtime === 'boolean') {
      return runtime
    }
  }
  return readEnvFlag()
}

export const setRenderMetricsOverride = (enabled: boolean | null): void => {
  override = enabled
}

const formatNumber = (value: number): number => Number(value.toFixed(2))

const logSummary = (): void => {
  if (!metrics.size) return
  const now = Date.now()
  if (now - lastLogTime < LOG_INTERVAL_MS) return
  lastLogTime = now

  const summary = Array.from(metrics.entries()).map(([id, entry]) => ({
    id,
    commits: entry.commits,
    totalActual: formatNumber(entry.totalActual),
    avgActual: formatNumber(entry.totalActual / entry.commits),
    maxActual: formatNumber(entry.maxActual),
    totalBase: formatNumber(entry.totalBase),
    avgBase: formatNumber(entry.totalBase / entry.commits),
    maxBase: formatNumber(entry.maxBase),
  }))

  summary.sort((a, b) => b.totalActual - a.totalActual)

  console.groupCollapsed('[render-metrics] Commit summary')
  console.table(summary)
  console.groupEnd()
}

const scheduleLog = (): void => {
  if (logTimer !== null) return
  logTimer = setTimeout(() => {
    logTimer = null
    logSummary()
  }, LOG_DELAY_MS) as unknown as number
}

const recordMetric = (id: string, actualDuration: number, baseDuration: number): void => {
  const current = metrics.get(id) ?? {
    commits: 0,
    totalActual: 0,
    totalBase: 0,
    maxActual: 0,
    maxBase: 0,
  }
  current.commits += 1
  current.totalActual += actualDuration
  current.totalBase += baseDuration
  current.maxActual = Math.max(current.maxActual, actualDuration)
  current.maxBase = Math.max(current.maxBase, baseDuration)
  metrics.set(id, current)
  scheduleLog()
}

const callbacks = new Map<string, ProfilerOnRenderCallback>()

const createProfilerCallback = (id: string): ProfilerOnRenderCallback => {
  return function onRender(
    _id,
    _phase,
    actualDuration,
    baseDuration,
  ) {
    recordMetric(id, actualDuration, baseDuration)
  }
}

export const getProfilerCallback = (id: string): ProfilerOnRenderCallback => {
  if (callbacks.has(id)) {
    return callbacks.get(id) as ProfilerOnRenderCallback
  }
  const callback = createProfilerCallback(id)
  callbacks.set(id, callback)
  return callback
}

export const resetRenderMetrics = (): void => {
  metrics.clear()
  callbacks.clear()
  if (logTimer !== null) {
    clearTimeout(logTimer)
    logTimer = null
  }
  lastLogTime = 0
}

export const getRenderMetricsSnapshot = (): Record<string, ComponentRenderMetrics> => {
  const snapshot: Record<string, ComponentRenderMetrics> = {}
  metrics.forEach((value, key) => {
    snapshot[key] = { ...value }
  })
  return snapshot
}
