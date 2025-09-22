import { SAFETY_WRAPPER_PROMPT } from './safety'
import { resolvePersonaPromptByScenarioId } from './allowlist'

export type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string }

export function composeMessages(options: {
  scenarioId?: string
  history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  user?: string
}): ChatMsg[] {
  const messages: ChatMsg[] = []
  messages.push({ role: 'system', content: SAFETY_WRAPPER_PROMPT })
  messages.push({ role: 'system', content: resolvePersonaPromptByScenarioId(options.scenarioId) })
  if (options.history && options.history.length) {
    for (const m of options.history) {
      // Never trust client 'system' role; degrade to user
      const role = m.role === 'system' ? 'user' : m.role
      messages.push({ role, content: m.content })
    }
  }
  if (options.user) messages.push({ role: 'user', content: options.user })
  return messages
}
