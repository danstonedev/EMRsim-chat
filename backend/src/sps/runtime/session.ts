import { sessions } from './store.js';

export { sessions } from './store.js';
export { loadSPSContent } from './content/loader.js';
export { convertPersonaBundle, buildDobChallenges } from './content/personas.js';
export { convertScenarioBundle, buildScenarioContext } from './content/scenarios.js';
export { loadContextModules, resolveModule, clearModuleRegistryCache } from './content/moduleRegistry.js';
export type { ModuleReference, ModuleRegistry } from './content/moduleRegistry.js';

export function getActiveSessionIds(): string[] {
  return [...sessions.keys()];
}

export function hasActiveSession(sessionId: string): boolean {
  return sessions.has(sessionId);
}

export function getActiveSessionCount(): number {
  return sessions.size;
}
