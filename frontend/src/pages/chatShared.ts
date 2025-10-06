export type PersonaLite = {
  id: string
  display_name: string
  headline?: string | null
  age?: number | null
  sex?: string | null
  voice?: string | null
  tags?: string[]
}

export type ScenarioLite = {
  scenario_id: string
  title: string
  region?: string | null
  difficulty?: string | null
  setting?: string | null
  tags?: string[]
  persona_id?: string | null
  persona_name?: string | null
  persona_headline?: string | null
}

export interface MediaReference {
  id: string
  type: 'image' | 'video'
  url: string
  thumbnail?: string
  caption: string
}

export type Message = {
  id: string
  role: 'user' | 'assistant'
  text: string
  channel: 'text' | 'voice'
  pending?: boolean
  source?: 'openai' | 'mock' | string
  timestamp: number
  sequenceId?: number
  media?: MediaReference
}

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2))

let globalSequenceCounter = 0

export const createMessage = (
  role: 'user' | 'assistant',
  text: string,
  channel: 'text' | 'voice',
  options: { pending?: boolean; source?: string; id?: string; timestamp?: number } = {}
): Message => ({
  id: options.id || newId(),
  role,
  text,
  channel,
  pending: options.pending,
  source: options.source,
  timestamp: options.timestamp ?? Date.now(),
  sequenceId: ++globalSequenceCounter
})

export const sortMessages = (messages: Message[]): Message[] => {
  return [...messages].sort((a, b) => {
    if (a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp
    }
    return (a.sequenceId || 0) - (b.sequenceId || 0)
  })
}

export const nextSequenceId = () => ++globalSequenceCounter
