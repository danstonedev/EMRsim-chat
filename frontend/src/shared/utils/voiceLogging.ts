const STORE_KEY = 'voice-debug-enabled'
const GLOBAL_FLAG = '__VOICE_DEBUG__'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

let cachedDebug: boolean | null = null
let cachedStamp = 0
const CACHE_TTL = 5_000 // ms

function readGlobalFlag(): boolean | null {
  if (typeof window === 'undefined') return null
  const globalFlag = (window as typeof window & { [GLOBAL_FLAG]?: unknown })[GLOBAL_FLAG]
  if (typeof globalFlag === 'boolean') {
    return globalFlag
  }
  return null
}

function readStoredValue(): boolean | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORE_KEY)
    if (raw == null) return null
    return raw === 'true'
  } catch (error) {
    console.debug('[voiceLogging] Failed to read localStorage toggle', error)
    return null
  }
}

function computeDebugEnabled(): boolean {
  const now = Date.now()
  if (cachedDebug !== null && now - cachedStamp < CACHE_TTL) {
    return cachedDebug
  }

  const globalFlag = readGlobalFlag()
  const stored = readStoredValue()
  let enabled: boolean
  if (stored !== null) {
    enabled = stored
  } else if (globalFlag !== null) {
    enabled = globalFlag
  } else {
    enabled = import.meta.env.MODE !== 'production'
  }

  cachedDebug = enabled
  cachedStamp = now
  return enabled
}

function shouldLog(level: LogLevel): boolean {
  if (level === 'warn' || level === 'error') {
    return true
  }
  return computeDebugEnabled()
}

function log(level: LogLevel, ...args: unknown[]): void {
  if (!shouldLog(level)) return
  const prefix = '[Voice]'
  switch (level) {
    case 'debug':
      console.debug(prefix, ...args)
      break
    case 'info':
      console.info(prefix, ...args)
      break
    case 'warn':
      console.warn(prefix, ...args)
      break
    case 'error':
      console.error(prefix, ...args)
      break
  }
}

export function voiceDebug(...args: unknown[]): void {
  log('debug', ...args)
}

export function voiceInfo(...args: unknown[]): void {
  log('info', ...args)
}

export function voiceWarn(...args: unknown[]): void {
  log('warn', ...args)
}

export function voiceError(...args: unknown[]): void {
  log('error', ...args)
}

export function setVoiceLoggingEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') {
    cachedDebug = enabled
    cachedStamp = Date.now()
    return
  }
  try {
    window.localStorage.setItem(STORE_KEY, String(enabled))
  } catch (error) {
    console.debug('[voiceLogging] Failed to persist localStorage toggle', error)
  }
  cachedDebug = enabled
  cachedStamp = Date.now()
}

export function getVoiceLoggingEnabled(): boolean {
  return computeDebugEnabled()
}
