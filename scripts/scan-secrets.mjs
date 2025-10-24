#!/usr/bin/env node
/*
  Simple secret scanner for obvious patterns.
  This is NOT a replacement for enterprise-grade scanning, but helps catch common mistakes.
*/

import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const includeGlobs = [
  '**/*.md',
  '**/*.ts',
  '**/*.tsx',
  '**/*.js',
  '**/*.json',
  '**/*.yml',
  '**/*.yaml',
  '**/*.env*'
];
const excludeDirs = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'playwright-report',
  'coverage',
  'test-results'
]);

// Common secret patterns
const patterns = [
  { name: 'OpenAI key', regex: /(?:sk-|rk-)[a-zA-Z0-9]{20,}/g },
  { name: 'AWS access key id', regex: /AKIA[0-9A-Z]{16}/g },
  // heuristic; JS doesn't support inline (?i), so use case-insensitive patterns sparingly
  { name: 'AWS secret access key (heuristic)', regex: /aws(.{0,20})?(secret|access).{0,20}?[A-Za-z0-9\/+=]{40}/gi },
  { name: 'Generic password literal', regex: /(password\s*[:=]\s*[`'"]?[A-Za-z0-9!@#$%^&*()_+\-={}|[\]\\:";'<>?,.\/]{8,}[`'"]?)/gi },
  { name: 'Azure MySQL host', regex: /mysql\.database\.azure\.com/gi },
  { name: 'JWT', regex: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g }
];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (excludeDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else {
      scanFile(full);
    }
  }
}

const findings = [];

function scanFile(file) {
  const rel = path.relative(repoRoot, file).replace(/\\/g, '/');
  if (!includeGlobs.some(glob => matchGlob(rel, glob))) return;
  const content = fs.readFileSync(file, 'utf8');
  for (const { name, regex } of patterns) {
    regex.lastIndex = 0;
    const matches = content.match(regex);
    if (matches && matches.length) {
      findings.push({ file: rel, rule: name, sample: matches.slice(0, 2) });
    }
  }
}

// Very small glob matcher for **/* patterns
function matchGlob(file, glob) {
  // convert ** to .*
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*');
  const re = new RegExp('^' + escaped + '$');
  return re.test(file);
}

walk(repoRoot);

if (findings.length) {
  console.error('\nPotential secrets found (manual review required):');
  for (const f of findings) {
    console.error(`- ${f.file} [${f.rule}] -> ${f.sample.join(' | ')}`);
  }
  process.exitCode = 1;
} else {
  console.log('No obvious secrets found.');
}
