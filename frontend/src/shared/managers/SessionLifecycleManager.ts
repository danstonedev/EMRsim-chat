/**
 * SessionLifecycleManager
 * 
 * Manages session state and lifecycle for voice conversations.
 * Extracted from ConversationController to separate concerns.
 * 
 * Responsibilities:
 * - Track session IDs (internal and external)
 * - Track persona and scenario configuration
 * - Provide session state queries
 * - Emit session change events
 */

export interface SessionConfig {
  personaId: string | null
  scenarioId: string | null
  sessionId: string | null
}

export interface SessionChangeCallback {
  (sessionId: string | null): void
}

export class SessionLifecycleManager {
  private sessionId: string | null = null
  private personaId: string | null = null
  private scenarioId: string | null = null
  private externalSessionId: string | null = null
  
  private onSessionChangeCallback: SessionChangeCallback | null = null

  constructor(config: Partial<SessionConfig> = {}) {
    this.personaId = config.personaId ?? null
    this.scenarioId = config.scenarioId ?? null
    this.externalSessionId = config.sessionId ?? null
    this.sessionId = config.sessionId ?? null
  }

  // Configuration setters
  setPersonaId(personaId: string | null): boolean {
    if (this.personaId === personaId) return false
    this.personaId = personaId
    this.clearSession()
    return true
  }

  setScenarioId(scenarioId: string | null): boolean {
    if (this.scenarioId === scenarioId) return false
    this.scenarioId = scenarioId
    return true
  }

  setExternalSessionId(sessionId: string | null): void {
    if (this.externalSessionId === sessionId) return
    this.externalSessionId = sessionId
    this.sessionId = sessionId
    this.notifySessionChange()
  }

  // Session lifecycle
  setSessionId(sessionId: string | null): void {
    if (this.sessionId === sessionId) return
    this.sessionId = sessionId
    this.notifySessionChange()
  }

  clearSession(): void {
    if (this.sessionId === null) return
    this.sessionId = null
    this.notifySessionChange()
  }

  // State queries
  getSessionId(): string | null {
    return this.sessionId
  }

  getPersonaId(): string | null {
    return this.personaId
  }

  getScenarioId(): string | null {
    return this.scenarioId
  }

  getExternalSessionId(): string | null {
    return this.externalSessionId
  }

  isActive(): boolean {
    return this.sessionId !== null
  }

  getConfig(): SessionConfig {
    return {
      personaId: this.personaId,
      scenarioId: this.scenarioId,
      sessionId: this.sessionId,
    }
  }

  // Event handling
  onSessionChange(callback: SessionChangeCallback): void {
    this.onSessionChangeCallback = callback
  }

  private notifySessionChange(): void {
    if (this.onSessionChangeCallback) {
      this.onSessionChangeCallback(this.sessionId)
    }
  }
}
