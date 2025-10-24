export type VoiceOption = { id: string; label?: string }

export const DEFAULT_VOICES: VoiceOption[] = [
  { id: 'alloy' },
  { id: 'ash' },
  { id: 'ballad' },
  { id: 'coral' },
  { id: 'echo' },
  { id: 'sage' },
  { id: 'shimmer' },
  { id: 'verse' },
  { id: 'marin' },
  { id: 'cedar' },
]

export const LANG_OPTIONS: Array<{ id: 'auto' | string; label: string }> = [
  { id: 'auto', label: 'Auto-detect' },
  { id: 'en', label: 'English' },
  { id: 'en-US', label: 'English (US)' },
  { id: 'en-GB', label: 'English (UK)' },
  { id: 'es', label: 'Spanish' },
  { id: 'fr', label: 'French' },
  { id: 'de', label: 'German' },
  { id: 'pt', label: 'Portuguese' },
  { id: 'it', label: 'Italian' },
]
