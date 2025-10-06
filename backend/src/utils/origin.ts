const FALLBACK_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
]

/**
 * Resolve allowed origins for CORS/socket usages.
 * Combines configured BACKEND_CORS_ORIGINS, optional defaults,
 * and FRONTEND_URL when present. Duplicates are removed while
 * preserving order of first appearance.
 */
export function resolveAllowedOrigins(extraDefaults: string[] = []): string[] {
  const envOrigins = (process.env.BACKEND_CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  const seeds = envOrigins.length ? envOrigins : FALLBACK_ORIGINS
  const combined = [...seeds, ...extraDefaults]
  if (process.env.FRONTEND_URL) {
    combined.push(process.env.FRONTEND_URL)
  }

  const seen = new Set<string>()
  const deduped: string[] = []
  for (const origin of combined) {
    if (!origin || seen.has(origin)) continue
    seen.add(origin)
    deduped.push(origin)
  }
  return deduped
}
