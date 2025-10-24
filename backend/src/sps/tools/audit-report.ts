#!/usr/bin/env tsx
/// <reference types="node" />

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ScenarioValidationService } from '../runtime/validation/scenarioValidationService.ts';

type BucketCounts = Record<string, number>;

interface AuditRow {
  scenario_id: string;
  title: string;
  region: string;
  difficulty?: string;
  subjective: BucketCounts;
  objective: BucketCounts;
  issues: Array<{ level: 'warning' | 'error'; code: string; message: string }>;
  needs_beef_up: boolean;
}

interface AuditOutput {
  generated_at: string;
  totals: { scenarios: number; errors: number; warnings: number; needs_beef_up: number };
  scenarios: AuditRow[];
}

function escapeMd(s: string): string {
  return s.replace(/[|*_`]/g, m => `\\${m}`);
}

function ensureDir(p: string): void {
  const dir = path.dirname(p);
  fs.mkdirSync(dir, { recursive: true });
}

function categorizeSubjective(id: string, label: string): string {
  const text = `${id} ${label}`.toLowerCase();
  if (/pain|hpi|history|onset|duration|aggravator|easer|24h|pattern|location|behavior|severity|opqrst/i.test(text))
    return 'Pain/HPI';
  if (/red *flag|night pain|weight loss|fever|cancer|cauda|saddle|incontinence/i.test(text)) return 'Red flags';
  if (/sdoh|work|job|role|caregiv|adl|sleep|stress|transport|home|environment/i.test(text)) return 'Function & SDOH';
  if (/med|medication|drug|allerg|pmh|psh|surgery|comorb|condition/i.test(text))
    return 'PMH/PSH/Medications/Allergies';
  if (/systems? review|ros|cardio|pulmo|neuro|gi|gu|endo|psych|derm/i.test(text)) return 'Systems review';
  if (/imaging|x[- ]?ray|mri|ct|ultra|prior (tx|treatment)|previous (care|therapy)/i.test(text))
    return 'Prior imaging/treatment';
  if (/goal/i.test(text)) return 'Goals';
  return 'Other subjective';
}

function categorizeObjective(id: string, label: string): string {
  const text = `${id} ${label}`.toLowerCase();
  if (/neuro|myotome|dermatome|reflex|sensation|hoffmann|babinski|slump|slr|ulsnt|neural/i.test(text))
    return 'Neurological';
  if (/\brom\b|range of motion|flexion|extension|abduction|adduction|rotation|pronation|supination|dorsiflex|plantarflex/i.test(text))
    return 'Range of motion';
  if (/strength|mmt|resisted|isometric|dynamometer|grip/i.test(text)) return 'Strength';
  if (/joint mobility|accessory|glide|posterior[- ]?anterior|pa spring|arthrokinematic/i.test(text)) return 'Joint mobility';
  if (/palpation|ttp|tenderness|edema|swelling|effusion|ecchymosis|observation|posture|inspection/i.test(text))
    return 'Observation & palpation';
  if (/balance|y[- ]?balance|single[- ]leg balance|romberg/i.test(text)) return 'Balance';
  if (/functional|sit[- ]?to[- ]?stand|squat|step[- ]?down|lunge|hop|jump|gait|stairs|reach|lift|carry/i.test(text))
    return 'Functional movement';
  if (/lachman|mcmurray|valgus|varus|thompson|hawkins|kennedy|neer|empty\s?can|drop\s?arm|apprehension|relocation|spurling|faber|faddir|ober|thomas|patellar|drawer|pivot|squeeze|talar|windlass|sulcus/i.test(text) || /\btest\b/.test(text))
    return 'Special tests';
  return 'Other';
}

function main(): void {
  // Options
  const args = process.argv.slice(2);
  let outMd = '../scripts/content-audit-report.md';
  let outJson = '../scripts/content-audit-report.json';
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--out-md') outMd = args[++i];
    else if (a.startsWith('--out-md=')) outMd = a.substring('--out-md='.length);
    else if (a === '--out-json') outJson = args[++i];
    else if (a.startsWith('--out-json=')) outJson = a.substring('--out-json='.length);
  }

  // Resolve content paths based on this file location
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const SPS_ROOT = path.resolve(__dirname, '..');
  const CONTENT_ROOT = path.join(SPS_ROOT, 'content');
  const INDEX_PATH = path.join(CONTENT_ROOT, 'scenarios', 'compiled', 'index.json');

  const indexRaw = fs.readFileSync(INDEX_PATH, 'utf8');
  const index = JSON.parse(indexRaw) as { scenarios: Record<string, { file?: string }> };

  const service = new ScenarioValidationService();

  const scenarioIds = Object.keys(index.scenarios).sort();
  const rows: AuditRow[] = [];
  let totalWarnings = 0;
  let totalErrors = 0;
  let totalNeeds = 0;

  for (const scenarioId of scenarioIds) {
    const entry = index.scenarios[scenarioId] || {};
    const compiledPath = entry.file
      ? path.join(CONTENT_ROOT, entry.file)
      : path.join(CONTENT_ROOT, 'scenarios', 'compiled', `${scenarioId}.json`);
    if (!fs.existsSync(compiledPath)) continue;
    const compiled = JSON.parse(fs.readFileSync(compiledPath, 'utf8'));

    const subj: any[] = Array.isArray(compiled?.scenario?.subjective_catalog)
      ? compiled.scenario.subjective_catalog
      : [];
    const obj: any[] = Array.isArray(compiled?.scenario?.objective_catalog)
      ? compiled.scenario.objective_catalog
      : [];

    const subjCounts: BucketCounts = {};
    for (const item of subj) {
      const id = String(item?.id || '');
      const label = String(item?.label || '');
      const bucket = categorizeSubjective(id, label);
      subjCounts[bucket] = (subjCounts[bucket] || 0) + 1;
    }

    const objCounts: BucketCounts = {};
    for (const o of obj) {
      const id = String(o?.test_id || '');
      const label = String(o?.label || '');
      const cat = categorizeObjective(id, label);
      objCounts[cat] = (objCounts[cat] || 0) + 1;
    }

    const defSummary = service.validateScenarioDefinition(scenarioId);
    const bundleSummary = service.validateScenarioBundle(scenarioId);
    const issues = [...defSummary.issues, ...bundleSummary.issues].map(i => ({
      level: i.level,
      code: i.code,
      message: i.message,
    }));

    const needs = issues.some(i => /^(S_|O_)/.test(i.code));
    if (needs) totalNeeds++;
    totalWarnings += issues.filter(i => i.level === 'warning').length;
    totalErrors += issues.filter(i => i.level === 'error').length;

    rows.push({
      scenario_id: scenarioId,
      title: String(compiled?.scenario?.title || ''),
      region: String(compiled?.scenario?.region || ''),
      difficulty: String(compiled?.scenario?.difficulty || ''),
      subjective: subjCounts,
      objective: objCounts,
      issues,
      needs_beef_up: needs,
    });
  }

  const output: AuditOutput = {
    generated_at: new Date().toISOString(),
    totals: { scenarios: rows.length, errors: totalErrors, warnings: totalWarnings, needs_beef_up: totalNeeds },
    scenarios: rows,
  };

  // Write JSON
  const jsonPath = path.resolve(__dirname, outJson);
  ensureDir(jsonPath);
  fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2), 'utf8');

  // Write Markdown
  const mdPath = path.resolve(__dirname, outMd);
  ensureDir(mdPath);

  const mdLines: string[] = [];
  mdLines.push(`# SPS Content Audit Report`);
  mdLines.push('');
  mdLines.push(`Generated: ${output.generated_at}`);
  mdLines.push('');
  mdLines.push(`- Scenarios: ${output.totals.scenarios}`);
  mdLines.push(`- Errors: ${output.totals.errors}`);
  mdLines.push(`- Warnings: ${output.totals.warnings}`);
  mdLines.push(`- Needs beef up: ${output.totals.needs_beef_up}`);
  mdLines.push('');

  for (const row of rows) {
    mdLines.push(`## ${escapeMd(row.title || row.scenario_id)} (${escapeMd(row.scenario_id)})`);
    mdLines.push('');
    mdLines.push(`Region: ${escapeMd(row.region || '—')}  |  Difficulty: ${escapeMd(row.difficulty || '—')}`);
    mdLines.push('');
    mdLines.push('### Subjective coverage');
    const subjEntries = Object.keys(row.subjective)
      .sort()
      .map(k => `- ${escapeMd(k)}: ${row.subjective[k]}`);
    mdLines.push(subjEntries.length ? subjEntries.join('\n') : '- —');
    mdLines.push('');
    mdLines.push('### Objective coverage');
    const objEntries = Object.keys(row.objective)
      .sort()
      .map(k => `- ${escapeMd(k)}: ${row.objective[k]}`);
    mdLines.push(objEntries.length ? objEntries.join('\n') : '- —');
    mdLines.push('');
    mdLines.push(`### Status: ${row.needs_beef_up ? 'Needs beef up' : 'Looks OK'}`);
    mdLines.push('');
    if (row.issues.length) {
      mdLines.push('#### Issues');
      for (const issue of row.issues) {
        mdLines.push(`- ${issue.level.toUpperCase()} ${escapeMd(issue.code)}: ${escapeMd(issue.message)}`);
      }
      mdLines.push('');
    }
  }

  fs.writeFileSync(mdPath, mdLines.join('\n'), 'utf8');

  // Human summary to console
  console.log(`Audit complete. MD: ${mdPath}\nJSON: ${jsonPath}`);
}

try {
  main();
} catch (e) {
  console.error('[audit] Failed:', (e as Error).message);
  process.exitCode = 1;
}
