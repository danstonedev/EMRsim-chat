/**
 * ServiceRegistry (Phase 3 scaffold)
 *
 * Goal: Move service initialization and dependency wiring out of ConversationController.
 * This is a safe, unused scaffold that can be iteratively filled without breaking builds.
 *
 * Implementation plan (from CONVERSATION_CONTROLLER_PHASE2_PLAN.md):
 * - Define ServiceRegistryConfig inputs (debug flags, managers, config)
 * - Initialize services in dependency order and return a typed registry
 * - Update ConversationController to consume the registry and assign fields
 *
 * For now, we export minimal types and a no-op factory to avoid compile errors
 * until we wire it in a follow-up commit.
 */

// Keep minimal surface to avoid import churn; expand incrementally when wiring begins.
export interface ServiceRegistryConfig {
  debugEnabled: boolean
}

// Expand to include actual service instances as Phase 3 proceeds.
export interface ServiceRegistry {
  // Placeholder to keep the type non-empty
  __scaffold: true
}

export function createServiceRegistry(
  _config: ServiceRegistryConfig,
  _callbacks: {
    logDebug: (...args: unknown[]) => void
  }
): ServiceRegistry {
  // Mark parameters as used to satisfy noUnusedParameters until wired
  void _config
  void _callbacks
  // TODO: Initialize services (eventEmitter, stateManager, audioManager, socketManager, webrtcManager, etc.)
  // and return them here once ConversationController is updated to use this factory.
  return { __scaffold: true }
}
