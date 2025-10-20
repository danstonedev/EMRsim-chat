import { beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ChatPage from './ChatPage'
import { SettingsProvider } from '../shared/settingsContext'

vi.mock('../shared/api.ts', () => {
  const api = {
  getSpsPersonas: vi.fn(() => Promise.resolve([{ id: 'persona-1', display_name: 'Alex Johnson', voice: 'alloy', tags: ['runner'], headline: 'Motivated patient' }])),
    getSpsScenarios: vi.fn(() => Promise.resolve([{ scenario_id: 'scenario-1', title: 'Hip Osteoarthritis' }])),
    getHealth: vi.fn(() => Promise.resolve({ ok: true, uptime_s: 42, db: 'ok', openai: 'ok', features: { voiceEnabled: false, spsEnabled: true, voiceDebug: false } })),
    saveSpsTurns: vi.fn(() => Promise.resolve({ ok: true, saved: 0 })),
    createSession: vi.fn(() => Promise.resolve({ session_id: 'session-123' })),
  openSpsExport: vi.fn(),
    getVoiceToken: vi.fn(() => Promise.resolve({ rtc_token: 'token', model: 'gpt', tts_voice: 'voice' })),
    postVoiceSdp: vi.fn(() => Promise.resolve('ok')),
  }
  return { api }
})

vi.mock('../shared/useVoiceSession', () => ({
  useVoiceSession: () => ({
    status: 'idle',
    error: null,
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    sendText: vi.fn(),
    refreshInstructions: vi.fn(() => Promise.resolve()),
    remoteAudioRef: { current: null },
    sessionId: null,
    userPartial: '',
    assistantPartial: '',
    micLevel: 0,
    debugEnabled: false,
    micPaused: false,
    micStream: null,
    peerConnection: null,
    encounterPhase: null,
    encounterGate: null,
    outstandingGate: [],
    updateEncounterState: vi.fn(),
    addEventListener: () => () => {},
    addConversationListener: () => () => {}
  })
}))

vi.mock('../shared/telemetry.ts', () => ({
  recordVoiceEvent: vi.fn()
}))

vi.mock('../shared/flags.ts', () => ({
  featureFlags: { voiceEnabled: false, spsEnabled: true, voiceDebug: false },
  FLAGS: { VOICE_ENABLED: false, VOICE_AUTOSTART: false }
}))

vi.mock('./CaseBuilder', () => ({
  default: () => <div data-testid="case-builder" />
}))

beforeAll(() => {
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn()
  })
})

describe('App case setup layout', () => {
  it('renders inline case setup region and no modal overlay', async () => {
    render(
      <MemoryRouter>
        <SettingsProvider>
          <ChatPage />
        </SettingsProvider>
      </MemoryRouter>
    )

    const caseSetupRegion = await screen.findByRole('region', { name: /case setup/i })
    expect(caseSetupRegion).toBeTruthy()

    expect(screen.queryByRole('dialog', { name: /case setup/i })).toBeNull()

    const personaSearch = within(caseSetupRegion).getByLabelText(/persona search/i)
    const scenarioSearch = within(caseSetupRegion).getByLabelText(/scenario search/i)
    expect((personaSearch as HTMLInputElement).value).toBe('')
    expect((scenarioSearch as HTMLInputElement).value).toBe('')

    const startVoiceChat = within(caseSetupRegion).getByRole('button', { name: /start voice chat/i }) as HTMLButtonElement
    expect(startVoiceChat.disabled).toBe(true)

    const printOptions = within(caseSetupRegion).getByRole('button', { name: /print options/i }) as HTMLButtonElement
    expect(printOptions.disabled).toBe(true)
  })
})
