#!/usr/bin/env node
// Generates a Markdown report summarizing persona language profiles
// Source: backend/src/sps/content/personas/realtime/realtime_personas.json

import fs from 'fs';
import path from 'path';

const root = process.cwd();
const personasPath = path.join(root, 'backend', 'src', 'sps', 'content', 'personas', 'realtime', 'realtime_personas.json');
const outputPath = path.join(root, 'PERSONA_LANGUAGE_REPORT.md');

function safeReadJSON(p) {
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

function classifyLanguage(persona) {
  const tags = Array.isArray(persona.tags) ? persona.tags.map(String).map((t) => t.toLowerCase()) : [];
  const langRaw = persona?.demographics?.primary_language || '';
  const lang = String(langRaw).toLowerCase();

  const mentions = {
    english:
      lang.includes('english') ||
      lang.includes('general american') ||
      lang.includes('neutral american') ||
      lang.includes('broadcast') ||
      lang.includes('british') ||
      lang.includes('irish') ||
      lang.includes('scottish') ||
      lang.includes('welsh') ||
      lang.includes('aave') ||
      lang.includes('pacific northwest') ||
      lang.includes('upper-midwest') ||
      lang.includes('mountain west') ||
      lang.includes('west-coast') ||
      lang.includes('east-coast') ||
      lang.includes('rural'),
    spanish: lang.includes('spanish') || lang.includes('es ' ) || lang.includes(' es-') || lang.includes(' en/es') || lang.includes('es bilingual'),
    french: lang.includes('french') || lang.includes(' fr') || lang.includes('fr;'),
    spanishDominant: lang.includes('spanish-dominant')
  };

  const isBilingual = tags.includes('bilingual') || lang.includes('bilingual') || lang.includes('fluent spanish') || lang.includes('fluent fr') || lang.includes('fluent french');

  // Prioritize explicit non-English dominance if stated
  if (mentions.spanishDominant) {
    return { category: 'Non-English dominant (Spanish)', detail: langRaw };
  }

  if (isBilingual) {
    if (mentions.spanish) return { category: 'Bilingual (EN/ES)', detail: langRaw };
    if (mentions.french) return { category: 'Bilingual (EN/FR)', detail: langRaw };
    return { category: 'Bilingual (EN + other)', detail: langRaw };
  }

  if (mentions.english) {
    return { category: 'English-dominant', detail: langRaw };
  }

  // Fallback: if no explicit English mention, but also not clearly bilingual
  return { category: 'Other/Unclear', detail: langRaw };
}

function makeTable(rows) {
  const header = ['patient_id', 'display_name', 'primary_language', 'tags', 'classification'];
  const lines = [];
  lines.push(`| ${header.join(' | ')} |`);
  lines.push(`| ${header.map(() => '---').join(' | ')} |`);
  for (const r of rows) {
    lines.push(`| ${r.patient_id} | ${r.display_name} | ${r.primary_language.replace(/\|/g, '\\|')} | ${r.tags.join(', ')} | ${r.classification} |`);
  }
  return lines.join('\n');
}

function run() {
  const personas = safeReadJSON(personasPath);
  const rows = [];
  const counts = {
    'English-dominant': 0,
    'Bilingual (EN/ES)': 0,
    'Bilingual (EN/FR)': 0,
    'Bilingual (EN + other)': 0,
    'Non-English dominant (Spanish)': 0,
    'Other/Unclear': 0
  };

  for (const p of personas) {
    const c = classifyLanguage(p);
    counts[c.category] = (counts[c.category] || 0) + 1;
    rows.push({
      patient_id: p.patient_id,
      display_name: p.display_name,
      primary_language: p?.demographics?.primary_language || '',
      tags: Array.isArray(p.tags) ? p.tags : [],
      classification: c.category
    });
  }

  const total = rows.length;
  const md = [];
  md.push('# Persona Language Report');
  md.push('');
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push('');
  md.push('## Summary');
  md.push('');
  for (const [k, v] of Object.entries(counts)) {
    md.push(`- ${k}: ${v}`);
  }
  md.push(`- Total: ${total}`);
  md.push('');
  md.push('## Details');
  md.push('');
  md.push(makeTable(rows));
  md.push('');

  fs.writeFileSync(outputPath, md.join('\n'), 'utf8');
  console.log(`Wrote report to ${outputPath}`);
}

run();
