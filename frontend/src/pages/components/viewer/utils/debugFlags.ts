export function isDebug(): boolean {
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('debug') === '1'
  } catch {
    return false
  }
}

export function isVerbose(): boolean {
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('verbose') === '1'
  } catch {
    return false
  }
}

function truthy(v: any): boolean {
  if (v == null) return false
  const s = String(v).toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'on' || s === 'enable' || s === 'enabled'
}

// Unified viewer debug flag: env var OR URL param (?debug=1 or ?viewerDebug=1)
export function viewerDebugEnabled(): boolean {
  try {
    const envVal = (import.meta as any)?.env?.VITE_VIEWER_DEBUG
    if (truthy(envVal)) return true
  } catch { /* ignore */ }
  try {
    const params = new URLSearchParams(window.location.search)
    if (truthy(params.get('viewerDebug')) || truthy(params.get('debug'))) return true
  } catch { /* ignore */ }
  try {
    const fromStorage = window.localStorage?.getItem('viewer.debug')
    if (truthy(fromStorage)) return true
    const fromWindow = (window as any).__VIEWER_DEBUG
    if (truthy(fromWindow)) return true
  } catch { /* ignore */ }
  return false
}
