import { z } from 'zod'

export type AgentInput = {
  agent: string
  params?: Record<string, unknown>
}

export type AgentResult = {
  ok: boolean
  agent: string
  output?: unknown
  error?: string
}

export interface AgentContext {
  now: () => number
  log: (...args: unknown[]) => void
}

export type AgentHandler = (ctx: AgentContext, params?: Record<string, unknown>) => Promise<unknown>

const registry = new Map<string, AgentHandler>()

export function registerAgent(name: string, handler: AgentHandler) {
  registry.set(name, handler)
}

export function getRegisteredAgents(): string[] {
  return Array.from(registry.keys())
}

export async function runAgent(input: AgentInput, ctx?: Partial<AgentContext>): Promise<AgentResult> {
  const schema = z.object({
    agent: z.string().min(1),
    params: z.record(z.any()).optional(),
  })
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, agent: input.agent, error: parsed.error.message }
  }

  const handler = registry.get(parsed.data.agent)
  if (!handler) {
    return { ok: false, agent: parsed.data.agent, error: 'unknown_agent' }
  }

  const context: AgentContext = {
    now: () => Date.now(),
    log: (...args: unknown[]) => console.log('[agent]', ...args),
    ...ctx,
  }

  try {
    const output = await handler(context, parsed.data.params)
    return { ok: true, agent: parsed.data.agent, output }
  } catch (e) {
    return { ok: false, agent: parsed.data.agent, error: (e as Error).message }
  }
}
