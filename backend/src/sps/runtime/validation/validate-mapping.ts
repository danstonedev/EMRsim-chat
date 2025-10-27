#!/usr/bin/env tsx
import { validateSuggestedPersonaMapping, validateScenarioKitMapping } from './mappingValidationService.js';

function main() {
  const summaries = [validateSuggestedPersonaMapping(), validateScenarioKitMapping()];
  const combined = summaries.reduce(
    (acc, s) => {
      acc.issues.push(...s.issues);
      acc.errors += s.errors;
      acc.warnings += s.warnings;
      return acc;
    },
    { issues: [] as any[], errors: 0, warnings: 0 }
  );
  const { errors, warnings, issues } = combined;

  if (!issues.length) {
    console.log('[mapping] ✅ Mapping validation passed (personas and kits).');
    process.exit(0);
  }

  for (const i of issues) {
    const where = [i.scenarioId ? `scenario=${i.scenarioId}` : null, i.personaId ? `persona=${i.personaId}` : null]
      .filter(Boolean)
      .join(' ');
    console.log(`[${i.level.toUpperCase()}] ${i.code}${where ? ' [' + where + ']' : ''}: ${i.message}`);
  }

  console.log(`\n[mapping] Completed with ${errors} error(s), ${warnings} warning(s).`);
  process.exit(errors > 0 ? 1 : 0);
}

main();
