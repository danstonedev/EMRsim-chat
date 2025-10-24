const TRUTHY = ['1', 'true', 'yes', 'on', 'enable', 'enabled'] as const

type TruthyValue = (typeof TRUTHY)[number]

function isTruthy(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    return TRUTHY.includes(value.toLowerCase() as TruthyValue)
  }
  return false
}

export function resolveDebug(): boolean {
  try {
    const envValue = ((import.meta as any)?.env?.VITE_VOICE_DEBUG ?? '') as string
    if (isTruthy(envValue)) {
      return true
    }

    if (typeof window !== 'undefined') {
      const fromStorage = window.localStorage?.getItem('voice.debug')
      if (isTruthy(fromStorage)) {
        return true
      }

      const fromWindow = (window as any).__VOICE_DEBUG
      if (isTruthy(fromWindow)) {
        return true
      }
    }
  } catch (err) {
    console.warn('[ConversationController] Failed to resolve voice debug flag', err)
    return false
  }

  return false
}

export function resolveBargeIn(): boolean {
  try {
    const raw = ((import.meta as any)?.env?.VITE_VOICE_BARGE_IN || '').toString().toLowerCase()
    if (TRUTHY.includes(raw as TruthyValue)) return true
  } catch (err) {
    console.warn('[ConversationController] Failed to resolve barge-in flag', err)
    return false
  }
  return false
}

export function resolveIceServers(): RTCIceServer[] | undefined {
  try {
    const raw = ((import.meta as any)?.env?.VITE_ICE_SERVERS_JSON ?? '') as string
    if (!raw) {
      return [{ urls: 'stun:stun.l.google.com:19302' }]
    }
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as RTCIceServer[]
  } catch (err) {
    console.warn('[ConversationController] Failed to parse ICE servers', err)
    return undefined
  }
  return undefined
}

export function resolveAdaptiveVadEnabled(): boolean {
  try {
    const raw = ((import.meta as any)?.env?.VITE_ADAPTIVE_VAD ?? 'true').toString().toLowerCase()
    return TRUTHY.includes(raw as TruthyValue)
  } catch (err) {
    console.warn('[ConversationController] Failed to resolve adaptive VAD flag, defaulting to enabled', err)
    return true
  }
}

export function resolveAdaptiveVadDebug(): boolean {
  try {
    const raw = ((import.meta as any)?.env?.VITE_ADAPTIVE_VAD_DEBUG ?? '').toString().toLowerCase()
    return TRUTHY.includes(raw as TruthyValue)
  } catch (err) {
    console.warn('[ConversationController] Failed to resolve adaptive VAD debug flag', err)
    return false
  }
}
