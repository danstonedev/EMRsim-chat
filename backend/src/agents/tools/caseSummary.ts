import { z } from 'zod'
import { AgentContext, registerAgent } from '../AgentRunner.js'
import { getSessionTurns } from '../../db.js'

// Params schema
const Params = z.object({
  sessionId: z.string().min(4),
  maxChars: z.number().int().positive().max(4000).optional(),
})

type Params = z.infer<typeof Params>

async function summarizeTextSimple(texts: string[], maxChars = 800): Promise<string> {
  // Heuristic summary: take first and last snippets and counts
  const joined = texts.join(' ')
  if (!joined.trim()) return 'No transcript content available.'
  const trimmed = joined.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= maxChars) return trimmed
  const head = trimmed.slice(0, Math.floor(maxChars * 0.6))
  const tail = trimmed.slice(-Math.floor(maxChars * 0.3))
  return `${head} … ${tail}`
}

async function handler(ctx: AgentContext, raw?: Record<string, unknown>) {
  const p = Params.parse(raw ?? {}) as Params
  ctx.log('case-summary start', { sessionId: p.sessionId })
  const turns = getSessionTurns(p.sessionId)
  const userCount = turns.filter(t => t.role === 'user').length
  const assistantCount = turns.filter(t => t.role === 'assistant').length
  const texts = turns.map(t => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.text}`)
  const summary = await summarizeTextSimple(texts, p.maxChars ?? 800)
  const output = {
    type: 'case-summary',
    sessionId: p.sessionId,
    userTurns: userCount,
    assistantTurns: assistantCount,
    totalTurns: turns.length,
    summary,
    generatedAt: new Date(ctx.now()).toISOString(),
  }
  ctx.log('case-summary complete', { userTurns: userCount, assistantTurns: assistantCount })
  return output
}

// Register on import
registerAgent('case-summary', handler)

export default handler
