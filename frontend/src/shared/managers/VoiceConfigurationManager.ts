import type { PreferredString } from '../../features/voice/conversation/types/config'

/**
 * VoiceConfigurationManager
 * 
 * Manages voice and language configuration settings for conversations.
 * Extracted from ConversationController (Phase 3.2).
 * 
 * Responsibilities:
 * - Voice selection (voiceOverride)
 * - Language configuration (inputLanguage, replyLanguage)
 * - Model selection (model, transcriptionModel)
 * - Session configuration building
 */

export interface VoiceConfigurationOptions {
  voiceOverride?: string | null
  inputLanguage?: PreferredString<'auto'>
  replyLanguage?: PreferredString<'default'>
  model?: string | null
  transcriptionModel?: string | null
}

export interface SessionConfigData {
  voiceOverride: string | null
  inputLanguage: PreferredString<'auto'>
  replyLanguage: PreferredString<'default'>
  model: string | null
  transcriptionModel: string | null
}

export class VoiceConfigurationManager {
  private voiceOverride: string | null
  private inputLanguage: PreferredString<'auto'>
  private replyLanguage: PreferredString<'default'>
  private model: string | null
  private transcriptionModel: string | null

  constructor(options: VoiceConfigurationOptions = {}) {
    this.voiceOverride = options.voiceOverride ?? null
    this.inputLanguage = options.inputLanguage ?? 'auto'
    this.replyLanguage = options.replyLanguage ?? 'default'
    this.model = options.model ?? null
    this.transcriptionModel = options.transcriptionModel ?? null
  }

  // ===========================
  // Getters
  // ===========================

  getVoiceOverride(): string | null {
    return this.voiceOverride
  }

  getInputLanguage(): PreferredString<'auto'> {
    return this.inputLanguage
  }

  getReplyLanguage(): PreferredString<'default'> {
    return this.replyLanguage
  }

  getModel(): string | null {
    return this.model
  }

  getTranscriptionModel(): string | null {
    return this.transcriptionModel
  }

  // ===========================
  // Setters
  // ===========================

  setVoiceOverride(voice: string | null): void {
    this.voiceOverride = voice
  }

  setInputLanguage(language: PreferredString<'auto'>): void {
    this.inputLanguage = language
  }

  setReplyLanguage(language: PreferredString<'default'>): void {
    this.replyLanguage = language
  }

  setModel(model: string | null): void {
    this.model = model
  }

  setTranscriptionModel(model: string | null): void {
    this.transcriptionModel = model
  }

  // ===========================
  // Session Configuration
  // ===========================

  /**
   * Builds the session configuration object for voice sessions.
   * Used when creating/updating voice connections.
   */
  buildSessionConfig(): SessionConfigData {
    return {
      voiceOverride: this.voiceOverride,
      inputLanguage: this.inputLanguage,
      replyLanguage: this.replyLanguage,
      model: this.model,
      transcriptionModel: this.transcriptionModel,
    }
  }

  // ===========================
  // Bulk Updates
  // ===========================

  /**
   * Updates multiple configuration options at once.
   * Useful for resetting or bulk-updating settings.
   */
  updateConfig(options: VoiceConfigurationOptions): void {
    if (options.voiceOverride !== undefined) {
      this.voiceOverride = options.voiceOverride
    }
    if (options.inputLanguage !== undefined) {
      this.inputLanguage = options.inputLanguage
    }
    if (options.replyLanguage !== undefined) {
      this.replyLanguage = options.replyLanguage
    }
    if (options.model !== undefined) {
      this.model = options.model
    }
    if (options.transcriptionModel !== undefined) {
      this.transcriptionModel = options.transcriptionModel
    }
  }
}
