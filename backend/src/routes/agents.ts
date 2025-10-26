import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { getRegisteredAgents, runAgent } from '../agents/AgentRunner.ts'
// Ensure built-in tools are registered
import '../agents/tools/caseSummary.ts'

export const router = Router()

/**
 * List registered agents
 */
router.get('/agents', (_req: Request, res: Response) => {
  res.json({ ok: true, agents: getRegisteredAgents() })
})

/**
 * Run an agent by name
 */
router.post('/agents/run', async (req: Request, res: Response) => {
  const schema = z.object({ agent: z.string().min(1), params: z.record(z.any()).optional() })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.message })

  const result = await runAgent(parsed.data, {
    now: () => Date.now(),
    log: (...args: unknown[]) => console.log('[agents]', ...args),
  })

  if (!result.ok) return res.status(400).json(result)
  return res.json(result)
})

export default router
