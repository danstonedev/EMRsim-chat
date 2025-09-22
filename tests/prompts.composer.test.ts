import { describe, it, expect } from 'vitest'
import { composeMessages } from '../src/lib/prompts/composer'

describe('composeMessages', () => {
  it('falls back to default when scenario unknown', () => {
    const msgs = composeMessages({ scenarioId: 'unknown', user: 'Hello' })
    expect(msgs[0].role).toBe('system') // safety
    expect(msgs[1].role).toBe('system') // persona
    expect(msgs.at(-1)?.content).toBe('Hello')
  })

  it('includes persona when scenario allowed', () => {
    const msgs = composeMessages({ scenarioId: 'lowBackPain', user: 'Hi' })
    expect(msgs[0].content).toContain('educational simulation')
    expect(msgs[1].content).toContain('Patient identity')
  })

  it('always prepends safety wrapper', () => {
    const msgs = composeMessages({ user: 'Hi' })
    expect(msgs[0].role).toBe('system')
    expect(msgs[0].content.toLowerCase()).toContain('simulation')
  })
})
