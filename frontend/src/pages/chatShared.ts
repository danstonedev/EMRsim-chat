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
  student_case_id?: string | null
  title: string
  region?: string | null
  difficulty?: string | null
  setting?: string | null
  tags?: string[]
  persona_id?: string | null
  persona_name?: string | null
  persona_headline?: string | null
  suggested_personas?: string[]
  guardrails?: {
    min_age?: number
    max_age?: number
    sex_required?: string
    impact_testing_unsafe?: boolean
    strict?: boolean
    [key: string]: any
  }
}

export interface MediaReference {
  id: string
  type: 'image' | 'video' | 'youtube' | 'animation'
  url: string
  thumbnail?: string
  caption: string
  // For type === 'animation'
  animationId?: string
  options?: { speed?: number; loop?: 'repeat' | 'once' }
}

export type Message = {
  id: string
  role: 'user' | 'assistant'
  text: string
  channel: 'text' | 'voice'
  pending?: boolean
  source?: string
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
  options: { pending?: boolean; source?: string; id?: string; timestamp?: number; media?: MediaReference } = {}
): Message => ({
  id: options.id || newId(),
  role,
  text,
  channel,
  pending: options.pending,
  source: options.source,
  timestamp: options.timestamp ?? Date.now(),
  sequenceId: ++globalSequenceCounter,
  media: options.media,
})

export const sortMessages = (messages: Message[]): Message[] => {
  // Trust the backend order - it already sorts by created_at ASC
  // Frontend doesn't need to re-sort, just preserve the order we receive
  return messages
}

export const nextSequenceId = () => ++globalSequenceCounter
