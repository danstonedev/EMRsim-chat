import { spsRegistry } from '../../core/registry.ts';
import { getSuggestedPersonas, mapScenarioToCaseId, loadScenarioKit } from '../kits.ts';

export type MappingValidationLevel = 'error' | 'warning';

export interface MappingValidationIssue {
  level: MappingValidationLevel;
  code: string;
  message: string;
  scenarioId?: string;
  personaId?: string;
}

export interface MappingValidationSummary {
  issues: MappingValidationIssue[];
  errors: number;
  warnings: number;
}

function toSummary(issues: MappingValidationIssue[]): MappingValidationSummary {
  const errors = issues.filter(i => i.level === 'error').length;
  const warnings = issues.filter(i => i.level === 'warning').length;
  return { issues, errors, warnings };
}

function issue(
  level: MappingValidationLevel,
  code: string,
  message: string,
  scenarioId?: string,
  personaId?: string
): MappingValidationIssue {
  return { level, code, message, scenarioId, personaId };
}

/**
 * Validate scenario → suggested personas mapping against registry guardrails.
 * - Scenario and persona existence
 * - Scenario.guardrails constraints: min_age/max_age/sex_required
 */
export function validateSuggestedPersonaMapping(): MappingValidationSummary {
  const issues: MappingValidationIssue[] = [];

  // Iterate over scenarios in the registry to keep validation bounded to available content
  for (const scenario of Object.values(spsRegistry.scenarios)) {
    const sid = scenario.scenario_id;
    const suggested = getSuggestedPersonas(sid);
    if (!suggested.length) continue;

    const guard = (scenario as any).guardrails || {};
    const strict: boolean = Boolean((guard as any).strict);
    for (const sp of suggested) {
      const persona = spsRegistry.personas[sp.id];
      if (!persona) {
        issues.push(issue('error', 'SUGGESTED_PERSONA_NOT_FOUND', 'Suggested persona not found in registry', sid, sp.id));
        continue;
      }
      const age = persona.demographics?.age;
      const sex = String(persona.demographics?.sex || '').toLowerCase();

      // Rule: Do not allow pregnancy/postpartum markers on a male persona
      const tags: string[] = Array.isArray(persona.tags)
        ? persona.tags.map((t: unknown) => String(t).toLowerCase())
        : [];
      const comorbidities: string[] = Array.isArray((persona as any).medical_baseline?.comorbidities)
        ? (persona as any).medical_baseline.comorbidities.map((c: any) => String(c).toLowerCase())
        : [];
      const hasPregnancyMarker = [...tags, ...comorbidities].some(t => /pregnan|pregnancy|pregnant|postpartum/.test(t));
      if (sex === 'male' && hasPregnancyMarker) {
        issues.push(
          issue(
            'error',
            'PREGNANCY_INCOMPATIBLE_WITH_SEX',
            'Persona marked pregnant/postpartum but sex is male',
            sid,
            sp.id
          )
        );
      }

      if (typeof guard.min_age === 'number' && typeof age === 'number' && age < guard.min_age) {
        issues.push(
          issue(
            strict ? 'error' : 'warning',
            'AGE_BELOW_MIN',
            `Persona age ${age} below scenario min_age ${guard.min_age}`,
            sid,
            sp.id
          )
        );
      }
      if (typeof guard.max_age === 'number' && typeof age === 'number' && age > guard.max_age) {
        issues.push(
          issue(
            strict ? 'error' : 'warning',
            'AGE_ABOVE_MAX',
            `Persona age ${age} above scenario max_age ${guard.max_age}`,
            sid,
            sp.id
          )
        );
      }
      if (guard.sex_required && sex && sex !== guard.sex_required) {
        issues.push(
          issue(
            strict ? 'error' : 'warning',
            'SEX_MISMATCH',
            `Persona sex ${sex} does not match required ${guard.sex_required}`,
            sid,
            sp.id
          )
        );
      }
    }
  }

  return toSummary(issues);
}

/**
 * Validate scenario → kit mapping integrity.
 * - If a scenario is explicitly mapped to a case_id but the kit file cannot be loaded → ERROR
 * - If a scenario has no explicit mapping and no kit exists at fallback (case_id = scenario_id) → WARNING
 */
export function validateScenarioKitMapping(): MappingValidationSummary {
  const issues: MappingValidationIssue[] = [];

  for (const scenario of Object.values(spsRegistry.scenarios)) {
    const sid = scenario.scenario_id;
    const mappedCaseId = mapScenarioToCaseId(sid);
    // When no explicit mapping exists, mapScenarioToCaseId returns the scenarioId
    const hasExplicit = mappedCaseId !== sid;
    const kit = loadScenarioKit(mappedCaseId);
    if (!kit && hasExplicit) {
      issues.push(
        issue(
          'error',
          'MAPPED_KIT_NOT_FOUND',
          `Scenario is mapped to case_id "${mappedCaseId}" but no kit was found`,
          sid
        )
      );
    } else if (!kit && !hasExplicit) {
      issues.push(
        issue(
          'warning',
          'SCENARIO_NOT_MAPPED',
          'Scenario has no explicit kit mapping and no fallback kit found; will use safe defaults',
          sid
        )
      );
    }
  }

  return toSummary(issues);
}
