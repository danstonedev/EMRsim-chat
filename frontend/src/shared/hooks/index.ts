/**
 * Custom React hooks for managing complex application state and logic.
 * These hooks extract reusable, testable logic from components.
 */

export { useMessageQueue } from './useMessageQueue'
export { useVoiceTranscripts } from './useVoiceTranscripts'
export { useTextMessages } from './useTextMessages'
export { useSessionLifecycle } from './useSessionLifecycle'
export { useConnectionProgress } from './useConnectionProgress'
export type { ConnectionProgress } from './useConnectionProgress'
export { useBackendData } from './useBackendData'
export type { BackendHealth, RuntimeFeatures } from './useBackendData'
export { useUIState } from './useUIState'
export { useMessageManager } from './useMessageManager'
export { useScenarioMedia } from './useScenarioMedia'
export { useDiagnostics } from './useDiagnostics'
export type { LogItem } from './useDiagnostics'
export { useBackendSocket } from './useBackendSocket'
export type {
	UseBackendSocketOptions,
	UseBackendSocketReturn,
	BackendSocketSnapshot,
	SocketConfig,
	SocketEventHandlers,
	TranscriptData,
	TranscriptErrorData,
	CatchupData,
} from './useBackendSocket'
export { useVoiceOrchestration, useVoiceTranscriptHandlers } from './useVoiceOrchestration'
export { usePrintActions } from './usePrintActions'
export { useVoiceAutostart } from './useVoiceAutostart'
export { usePartialClearing } from './usePartialClearing'
export { useUIEffects } from './useUIEffects'
export type { PersonaLite, ScenarioLite } from '../../pages/chatShared'
