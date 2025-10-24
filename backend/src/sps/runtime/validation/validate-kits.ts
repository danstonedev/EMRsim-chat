#!/usr/bin/env tsx
import { validateAllKits } from './kitsValidationService.ts';

function main() {
  const summary = validateAllKits();
  const { errors, warnings, issues } = summary;

  if (!issues.length) {
    console.log('[kits] ✅ All kits valid.');
    process.exit(0);
  }

  for (const i of issues) {
    const where = i.kitId ? ` [${i.kitId}]` : '';
    console.log(`[${i.level.toUpperCase()}] ${i.code}${where}: ${i.message}`);
    if (i.details) {
      try {
        console.log('  details:', JSON.stringify(i.details, null, 2));
      } catch {
        // ignore
      }
    }
  }

  console.log(`\n[kits] Completed with ${errors} error(s), ${warnings} warning(s).`);
  process.exit(errors > 0 ? 1 : 0);
}

main();
