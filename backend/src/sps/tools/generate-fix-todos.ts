#!/usr/bin/env tsx
/// <reference types="node" />

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface AuditRow {
  scenario_id: string;
  title: string;
  region: string;
  difficulty?: string;
  subjective: Record<string, number>;
  objective: Record<string, number>;
  issues: Array<{ level: 'warning' | 'error'; code: string; message: string }>;
  needs_beef_up: boolean;
}

interface AuditJson {
  generated_at: string;
  totals: { scenarios: number; errors: number; warnings: number; needs_beef_up: number };
  scenarios: AuditRow[];
}

const REQUIRED_SUBJ = [
  'Pain/HPI',
  'Red flags',
  'Function & SDOH',
  'PMH/PSH/Medications/Allergies',
  'Systems review',
  'Goals',
];

const REQUIRED_OBJ = ['Observation & palpation', 'Functional movement', 'Range of motion', 'Strength', 'Special tests'];

function escapeMd(s: string): string {
  return s.replace(/[|*_`]/g, m => `\\${m}`);
}

function listMissing(required: string[], counts: Record<string, number>): string[] {
  return required.filter(name => !counts[name]);
}

function regionChecklist(region: string): string[] {
  const r = region.toLowerCase();
  const out: string[] = [];
  if (r === 'knee') {
    out.push(
      '- [ ] ROM: flexion and extension',
      '- [ ] Strength: quadriceps and hamstrings MMT',
      '- [ ] Palpation: joint line or effusion',
      '- [ ] Functional: squat or step-down',
      '- [ ] Special tests: Lachman/anterior drawer; valgus; varus; McMurray'
    );
  }
  if (r === 'shoulder') {
    out.push(
      '- [ ] ROM: flexion and abduction',
      '- [ ] Strength: abduction/supraspinatus',
      '- [ ] Special tests: Hawkins–Kennedy or Neer; Empty Can; Apprehension/Relocation'
    );
  }
  if (r === 'ankle' || r === 'foot' || r === 'ankle_foot') {
    out.push(
      '- [ ] ROM: dorsiflexion and plantarflexion',
      '- [ ] Strength: tibialis ant/post; peroneals; gastroc/soleus',
      '- [ ] Palpation: ATFL, CFL, PTFL; navicular; base of 5th',
      '- [ ] Functional: single-leg balance; heel raise',
      '- [ ] Special tests: Anterior Drawer; Talar Tilt; Thompson'
    );
  }
  if (/cervical_spine|lumbar_spine/.test(r)) {
    out.push(
      '- [ ] ROM: flexion, extension, rotation, side-bend',
      '- [ ] Neuro: myotomes, dermatomes/sensation, reflexes',
      /lumbar_spine/.test(r) ? '- [ ] Neural tension: SLR and Prone Knee Bend' : '- [ ] Neural tension: ULTT',
      '- [ ] Note centralization/peripheralization response',
      '- [ ] Subjective: include explicit red flags screening'
    );
  }
  return out;
}

function main(): void {
  const args = process.argv.slice(2);
  // Default paths relative to this tool location
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRootJsonDefault = path.resolve(__dirname, '../../../../scripts/content-audit-report.json');
  const repoRootOutDirDefault = path.resolve(__dirname, '../../../../scripts/audit-todos');

  let inputJson = repoRootJsonDefault;
  let outDir = repoRootOutDirDefault;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--in' && args[i + 1]) inputJson = path.resolve(args[++i]);
    else if (a.startsWith('--in=')) inputJson = path.resolve(a.substring('--in='.length));
    else if (a === '--out-dir' && args[i + 1]) outDir = path.resolve(args[++i]);
    else if (a.startsWith('--out-dir=')) outDir = path.resolve(a.substring('--out-dir='.length));
  }

  if (!fs.existsSync(inputJson)) {
    console.error(`[audit:todos] Input not found: ${inputJson}`);
    process.exitCode = 1;
    return;
  }

  const raw = fs.readFileSync(inputJson, 'utf8');
  const audit: AuditJson = JSON.parse(raw);

  fs.mkdirSync(outDir, { recursive: true });

  let created = 0;
  for (const row of audit.scenarios) {
    // Always create a file; clearly mark status
    const missingSubj = listMissing(REQUIRED_SUBJ, row.subjective);
    const missingObj = listMissing(REQUIRED_OBJ, row.objective);
    const regionList = regionChecklist(row.region || '');

    const lines: string[] = [];
    lines.push(`# Case fix checklist: ${escapeMd(row.title || row.scenario_id)}`);
    lines.push('');
    lines.push(
      `Scenario ID: ${escapeMd(row.scenario_id)}  |  Region: ${escapeMd(row.region || '—')}  |  Difficulty: ${escapeMd(
        row.difficulty || '—'
      )}`
    );
    lines.push('');
    lines.push(`Status: ${row.needs_beef_up ? 'Needs beef up' : 'Looks OK'}`);
    lines.push('');
    lines.push('## Subjective: required buckets');
    if (missingSubj.length === 0) {
      lines.push('- [x] All required Subjective buckets present');
    } else {
      for (const b of REQUIRED_SUBJ) {
        const present = !missingSubj.includes(b);
        lines.push(`- [${present ? 'x' : ' '}] ${escapeMd(b)}`);
      }
    }
    lines.push('');
    lines.push('## Objective: required categories');
    if (missingObj.length === 0) {
      lines.push('- [x] All required Objective categories present');
    } else {
      for (const c of REQUIRED_OBJ) {
        const present = !missingObj.includes(c);
        lines.push(`- [${present ? 'x' : ' '}] ${escapeMd(c)}`);
      }
    }
    lines.push('');
    if (regionList.length) {
      lines.push('## Region-specific must-haves');
      for (const item of regionList) lines.push(item);
      lines.push('');
    }
    if (row.issues.length) {
      lines.push('## Current issues');
      for (const issue of row.issues) {
        lines.push(`- ${issue.level.toUpperCase()} ${escapeMd(issue.code)}: ${escapeMd(issue.message)}`);
      }
      lines.push('');
    }

    const outPath = path.join(outDir, `${row.scenario_id}.md`);
    fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
    created++;
  }

  console.log(`[audit:todos] Wrote ${created} checklist files to ${outDir}`);
}

try {
  main();
} catch (e) {
  console.error('[audit:todos] Failed:', (e as Error).message);
  process.exitCode = 1;
}
