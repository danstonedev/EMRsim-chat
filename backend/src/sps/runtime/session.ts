import { sessions } from './store.ts';

export { sessions } from './store.ts';
export { loadSPSContent } from './content/loader.ts';
export { convertPersonaBundle, buildDobChallenges } from './content/personas.ts';
export { convertScenarioBundle, buildScenarioContext } from './content/scenarios.ts';
export { loadContextModules, resolveModule, clearModuleRegistryCache } from './content/moduleRegistry.ts';
export type { ModuleReference, ModuleRegistry } from './content/moduleRegistry.ts';

export function getActiveSessionIds(): string[] {
  return [...sessions.keys()];
}

export function hasActiveSession(sessionId: string): boolean {
  return sessions.has(sessionId);
}

export function getActiveSessionCount(): number {
  return sessions.size;
}
