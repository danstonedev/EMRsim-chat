#!/usr/bin/env tsx
/// <reference types="node" />

import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  ScenarioValidationService,
  type ValidationIssue,
  type ValidationSummary,
} from '../runtime/validation/scenarioValidationService.ts';

interface CLIOptions {
  scenarioFilter: Set<string> | null;
  outputJson: boolean;
}

interface ScenarioReport {
  scenarioId: string;
  definition: ValidationSummary;
  bundle: ValidationSummary;
}

interface ValidationOutput {
  compiled: ValidationSummary;
  scenarios: ScenarioReport[];
  totals: {
    errors: number;
    warnings: number;
  };
  issues: ValidationIssue[];
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const scenarioIds: string[] = [];
  let outputJson = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--scenario' || arg === '-s') {
      const value = args[i + 1];
      if (!value) {
        throw new Error('Missing value for --scenario flag');
      }
      scenarioIds.push(value.trim());
      i++;
    } else if (arg.startsWith('--scenario=')) {
      const value = arg.substring('--scenario='.length).trim();
      if (value) scenarioIds.push(value);
    } else if (arg === '--json' || arg === '--output=json') {
      outputJson = true;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      console.warn(`[validate] Unknown flag ignored: ${arg}`);
    }
  }

  const scenarioFilter = scenarioIds.length ? new Set(scenarioIds) : null;
  return { scenarioFilter, outputJson };
}

function printUsage(): void {
  console.log(
    `SPS Scenario Validation\n\n` +
      `Usage: npx tsx src/sps/tools/validate-content.ts [options]\n\n` +
      `Options:\n` +
      `  --scenario <id>      Validate only the specified scenario (can repeat)\n` +
      `  --json               Output machine-readable JSON summary\n` +
      `  -h, --help           Show this help message`
  );
}

function collectIssues(summary: ValidationSummary, scenarioId?: string): ValidationIssue[] {
  if (!scenarioId) return summary.issues;
  return summary.issues.map(issue => (issue.scenarioId ? issue : { ...issue, scenarioId }));
}

function colorize(level: ValidationIssue['level'], message: string): string {
  const RESET = '\u001B[0m';
  const RED = '\u001B[31m';
  const YELLOW = '\u001B[33m';
  switch (level) {
    case 'error':
      return `${RED}${message}${RESET}`;
    case 'warning':
      return `${YELLOW}${message}${RESET}`;
    default:
      return message;
  }
}

function printHumanReadable(output: ValidationOutput): void {
  const scriptPath = fileURLToPath(import.meta.url);
  const scriptName = path.basename(scriptPath);
  console.log(`\n=== SPS Scenario Validation (${scriptName}) ===`);
  console.log(`Scenarios inspected: ${output.scenarios.length}`);
  console.log(`Errors: ${output.totals.errors}  Warnings: ${output.totals.warnings}\n`);

  if (output.compiled.errors || output.compiled.warnings) {
    console.log('Global compiled asset checks:');
    for (const issue of output.compiled.issues) {
      console.log(`  - ${colorize(issue.level, issue.code)} :: ${issue.message}`);
    }
    console.log('');
  }

  for (const report of output.scenarios) {
    const totalErrors = report.definition.errors + report.bundle.errors;
    const totalWarnings = report.definition.warnings + report.bundle.warnings;
    console.log(`Scenario ${report.scenarioId}: ${totalErrors} errors, ${totalWarnings} warnings`);

    if (!report.definition.issues.length && !report.bundle.issues.length) {
      console.log('  ✓ OK');
      continue;
    }

    if (report.definition.issues.length) {
      console.log('  Definition checks:');
      for (const issue of report.definition.issues) {
        console.log(`    - ${colorize(issue.level, issue.code)} :: ${issue.message}`);
      }
    }

    if (report.bundle.issues.length) {
      console.log('  Compiled artifact checks:');
      for (const issue of report.bundle.issues) {
        console.log(`    - ${colorize(issue.level, issue.code)} :: ${issue.message}`);
      }
    }

    console.log('');
  }

  if (!output.totals.errors && !output.totals.warnings) {
    console.log('All checks passed.');
  }
}

function run(): void {
  const options = parseArgs();
  const service = new ScenarioValidationService();

  const compiledSummary = service.validateCompiledAssets(options.scenarioFilter);

  const scenarioIds =
    options.scenarioFilter && options.scenarioFilter.size
      ? Array.from(options.scenarioFilter)
      : Array.from(new Set([...service.getScenarioIds(), ...service.getCompiledScenarioIds()])).sort();

  const scenarioReports: ScenarioReport[] = [];
  const aggregatedIssues: ValidationIssue[] = [...compiledSummary.issues];

  for (const scenarioId of scenarioIds) {
    const definitionSummary = service.validateScenarioDefinition(scenarioId);
    const bundleSummary = service.validateScenarioBundle(scenarioId);

    scenarioReports.push({
      scenarioId,
      definition: definitionSummary,
      bundle: bundleSummary,
    });

    aggregatedIssues.push(...collectIssues(definitionSummary, scenarioId));
    aggregatedIssues.push(...collectIssues(bundleSummary, scenarioId));
  }

  const totals = {
    errors: aggregatedIssues.filter(issue => issue.level === 'error').length,
    warnings: aggregatedIssues.filter(issue => issue.level === 'warning').length,
  };

  const output: ValidationOutput = {
    compiled: compiledSummary,
    scenarios: scenarioReports,
    totals,
    issues: aggregatedIssues,
  };

  if (options.outputJson) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    printHumanReadable(output);
  }

  if (totals.errors > 0) {
    process.exitCode = 1;
  }
}

try {
  run();
} catch (error) {
  console.error('[validate] Fatal error:', (error as Error).message);
  process.exitCode = 1;
}
