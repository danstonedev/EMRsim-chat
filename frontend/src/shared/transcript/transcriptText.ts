const NULL_CHAR_REGEX = /[\u0000\r]/g

export function normalizeFullCandidate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value.replace(NULL_CHAR_REGEX, '')
  const trimmed = cleaned.trim()
  return trimmed.length ? trimmed : null
}

export function normalizeDeltaCandidate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value.replace(NULL_CHAR_REGEX, '')
  return cleaned.length ? cleaned : null
}

function collectContentFragments(nodes: any[], deltaParts: string[], fullParts: string[], forceDelta = false): void {
  if (!Array.isArray(nodes)) return
  for (const node of nodes) {
    if (!node) continue
    const type = typeof node?.type === 'string' ? node.type.toLowerCase() : ''
    const isDelta = forceDelta || type.includes('delta')
    const texts = [node?.text, node?.transcript, node?.output_text, node?.value]
    for (const candidate of texts) {
      if (isDelta) {
        const normalized = normalizeDeltaCandidate(candidate)
        if (normalized != null) deltaParts.push(normalized)
      } else {
        const normalized = normalizeFullCandidate(candidate)
        if (normalized != null) fullParts.push(normalized)
      }
    }
    if (Array.isArray(node?.content)) {
      collectContentFragments(node.content, deltaParts, fullParts, isDelta)
    }
  }
}

function scanObjectForText(value: any, deltaParts: string[], fullParts: string[], seen = new Set<any>()): void {
  if (!value || typeof value !== 'object') return
  if (seen.has(value)) return
  seen.add(value)
  for (const [key, raw] of Object.entries(value)) {
    const lowerKey = key.toLowerCase()
    if (typeof raw === 'string') {
      const target = lowerKey.includes('delta') ? normalizeDeltaCandidate(raw) : normalizeFullCandidate(raw)
      if (target != null) {
        if (lowerKey.includes('delta')) deltaParts.push(target)
        else if (lowerKey.includes('text') || lowerKey.includes('transcript')) fullParts.push(target)
      }
      continue
    }
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item === 'string') {
          const target = lowerKey.includes('delta') ? normalizeDeltaCandidate(item) : normalizeFullCandidate(item)
          if (target != null) {
            if (lowerKey.includes('delta')) deltaParts.push(target)
            else if (lowerKey.includes('text') || lowerKey.includes('transcript')) fullParts.push(target)
          }
        } else if (item && typeof item === 'object') {
          scanObjectForText(item, deltaParts, fullParts, seen)
        }
      }
      continue
    }
    if (raw && typeof raw === 'object') {
      scanObjectForText(raw, deltaParts, fullParts, seen)
    }
  }
}

export function extractPayloadTexts(payload: any): { fullText: string | null; deltaText: string | null } {
  const deltaParts: string[] = []
  const fullParts: string[] = []

  const pushFull = (value: unknown) => {
    const normalized = normalizeFullCandidate(value)
    if (normalized != null) fullParts.push(normalized)
  }
  const pushDelta = (value: unknown) => {
    const normalized = normalizeDeltaCandidate(value)
    if (normalized != null) deltaParts.push(normalized)
  }

  pushFull(payload?.text)
  pushFull(payload?.transcript)
  pushFull(payload?.output_text)
  pushFull(payload?.content_part?.text)
  pushDelta(payload?.delta_text)
  pushDelta(payload?.transcript_delta)
  pushDelta(payload?.output_text_delta)
  pushDelta(payload?.content_part?.delta)

  if (typeof payload?.delta === 'string') {
    pushDelta(payload.delta)
  } else if (payload?.delta && typeof payload.delta === 'object') {
    pushDelta(payload.delta?.text)
    pushDelta(payload.delta?.transcript)
    pushDelta(payload.delta?.output_text)
    collectContentFragments(payload.delta?.content, deltaParts, fullParts, true)
  }

  collectContentFragments(payload?.content, deltaParts, fullParts)
  collectContentFragments(payload?.content_part?.content, deltaParts, fullParts)

  if (payload?.item) {
    pushFull(payload.item?.text)
    pushFull(payload.item?.transcript)
    pushFull(payload.item?.output_text)
    if (!payload?.delta) {
      collectContentFragments(payload.item?.content, deltaParts, fullParts)
    }
    if (typeof payload.item?.delta === 'string') {
      pushDelta(payload.item.delta)
    }
  }

  if (!deltaParts.length && !fullParts.length) {
    scanObjectForText(payload, deltaParts, fullParts)
  }

  const fullText = fullParts.length
    ? fullParts.reduce((best, current) => (current.length >= best.length ? current : best))
    : null
  const deltaText = deltaParts.length ? deltaParts.join('') : null

  return { fullText, deltaText }
}

export function mergeDelta(existing: string, addition: string): string {
  if (!existing) return normalizeFullCandidate(addition) ?? addition.trim()
  if (!addition) return existing

  if (addition.startsWith(existing)) {
    const merged = addition
    return normalizeFullCandidate(merged) ?? merged.trim()
  }

  if (existing.includes(addition)) {
    if (import.meta.env.DEV) {
      console.debug('[TranscriptEngine] ⏭️ Skipping redundant delta (already in buffer)')
    }
    return existing
  }

  if (existing.startsWith(addition)) {
    if (import.meta.env.DEV) {
      console.debug('[TranscriptEngine] ⏭️ Skipping stale delta (older than buffer)')
    }
    return existing
  }

  let idx = 0
  const max = Math.min(existing.length, addition.length)
  while (idx < max && existing[idx] === addition[idx]) idx += 1

  if (idx === 0) {
    if (import.meta.env.DEV) {
      console.debug('[TranscriptEngine] No overlap detected, appending delta')
    }
    const merged = `${existing}${addition}`
    return normalizeFullCandidate(merged) ?? merged.trim()
  }

  const merged = existing.slice(0, idx) + addition.slice(idx)
  return normalizeFullCandidate(merged) ?? merged.trim()
}
