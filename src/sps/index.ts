/**
 * SPS Content System
 * 
 * This module provides access to the Simulated Patient System content, including
 * scenarios, personas, and supporting content assets. The API surface has been
 * streamlined as part of the SPS Content Refactor (Oct 2025).
 * 
 * @module sps
 */

// Core content loading and registry
import { loadSPSContent, getSPSRegistry } from './runtime/session';
export { loadSPSContent, getSPSRegistry };

// Public type definitions
export type { 
  SPSScenario, 
  SPSPersona, 
  SPSModule,
  SPSContext,
  SPSCatalog,
  SPSChallenge,
  SPSSpecialQuestion
} from './core/types';

// Content versioning utilities
export { 
  loadContentManifest,
  loadDependencyManifest,
  resolveContentVersion,
  assertDependenciesCurrent
} from './core/versioning';

// Normalization utilities (for authors and tools)
export {
  normalizePersona,
  mapTone,
  mapVerbosity,
  mapSleepQuality,
  coerceDob
} from './core/normalization';

/**
 * Singleton instance of the SPS Registry
 * This is the primary entry point for accessing loaded content
 */
import { SPSRegistry } from './runtime/registry';
export const spsRegistry = new SPSRegistry();

/**
 * @deprecated Use spsRegistry instead - Will be removed in future version
 */
export { spsRegistry as registry };

// Re-export core constants (paths, etc.)
export { CONTENT_PATHS } from './core/constants';

/**
 * Internal utilities - not part of public API
 * @internal
 */
export * as internal from './runtime/internal';
