import { spsRegistry } from '../core/registry';
import { ActiveCase } from '../core/types';

export function randomActiveCase(filter?: { region?: string; tagsInclude?: string[] }): ActiveCase {
  const personas = Object.keys(spsRegistry.personas);
  const scenarios = Object.values(spsRegistry.scenarios).filter(s=>{
    if (filter?.region && s.region!==filter.region) return false;
    if (filter?.tagsInclude && !filter.tagsInclude.every(t=>s.tags?.includes(t))) return false;
    return true;
  });
  const p = personas[Math.floor(Math.random()*personas.length)];
  const s = scenarios[Math.floor(Math.random()*scenarios.length)];
  return spsRegistry.composeActiveCase(p, s.scenario_id);
}
