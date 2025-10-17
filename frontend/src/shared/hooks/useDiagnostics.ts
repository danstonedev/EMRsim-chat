import { useCallback, useEffect, useState } from 'react'
import type { VoiceSessionHandle } from '../useVoiceSession'

const MAX_LOG_ITEMS = 1000

export interface LogItem {
  t: string
  kind: string
  src: string
  msg: string
  data?: any
}

interface RuntimeFeatures {
  voiceEnabled: boolean
  spsEnabled: boolean
  voiceDebug: boolean
}

interface UseDiagnosticsOptions {
  voiceSession: VoiceSessionHandle
  runtimeFeatures: RuntimeFeatures
  voiceDebugFlag: boolean
  logOpen: boolean
}

/**
 * Custom hook to manage diagnostics logging and debug settings.
 * Handles event logging from voice session and provides copy logs functionality.
 * 
 * Responsibilities:
 * - Track diagnostic log items from voice session events
 * - Determine if diagnostics should be enabled
 * - Provide copy logs functionality
 * - Limit log items to prevent memory issues
 */
export function useDiagnostics({
  voiceSession,
  runtimeFeatures,
  voiceDebugFlag,
  logOpen,
}: UseDiagnosticsOptions) {
  const [logItems, setLogItems] = useState<LogItem[]>([])

  // Enable diagnostics based on flags; do not couple to drawer open state so logging can start before UI is opened.
  const diagnosticsEnabledFlag = runtimeFeatures.voiceDebug || voiceDebugFlag

  // Determine if debug should be enabled for voice session
  const debugEnabled = (diagnosticsEnabledFlag || logOpen) ? true : undefined

  // Listen to voice session events and collect logs
  useEffect(() => {
    const off = voiceSession.addEventListener((e: any) => {
      setLogItems(prev => {
        const next = [...prev, { t: e.t, kind: e.kind, src: e.src, msg: e.msg, data: e.data }]
        return next.slice(-MAX_LOG_ITEMS)
      })
    })
    return off
    // Intentionally subscribe once; addEventListener is stable and controller persists.
    // Re-subscribing on each render can create a feedback loop with frequent updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Copy diagnostic logs to clipboard in a human-readable format
   */
  const handleCopyLogs = useCallback(() => {
    try {
      const text = logItems.map(li => {
        const preview = typeof li.data?.preview === 'string' ? li.data.preview
          : typeof li.data?.text === 'string' ? li.data.text
          : typeof li.data?.transcript === 'string' ? li.data.transcript
          : typeof li.data?.delta === 'string' ? li.data.delta
          : ''
        const suffix = preview ? ` — ${preview}` : ''
        return `${li.t} ${li.kind.toUpperCase()} ${li.src}: ${li.msg}${suffix}`
      }).join('\n')
      navigator.clipboard?.writeText(text)
    } catch {
      // no-op: clipboard may be unavailable
    }
  }, [logItems])

  return {
    logItems,
    diagnosticsEnabledFlag,
    debugEnabled,
    handleCopyLogs,
  }
}
