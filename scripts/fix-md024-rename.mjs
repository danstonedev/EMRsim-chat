#!/usr/bin/env node
// Auto-rename duplicate sibling headings (MD024) by appending " (2)", "(3)", ...
// - Handles ATX and Setext headings
// - Skips code fences and YAML front matter
// - Only renames when two headings with the same text appear at the same level under the same parent

import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'playwright-report', 'test-results']);

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!IGNORED_DIRS.has(e.name)) walk(full, out);
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
      out.push(full);
    }
  }
}

function isFence(line) {
  const t = line.trim();
  return (t.startsWith('```') || t.startsWith('~~~')) && !t.startsWith('````') && !t.startsWith('~~~~');
}

function slugify(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function processFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);

  let inFrontMatter = lines[0]?.trim() === '---';
  let inCode = false;
  // Track duplicate headings per parent stack
  // Stack of Maps: level -> Map(text->count)
  const textStack = [new Map()]; // level 0 pseudo-root

  const atxRe = /^(\s{0,3})(#{1,6})\s+(.*?)\s*#*\s*$/;
  const setextUnderlineRe = /^\s{0,3}(=+|-+)\s*$/;

  let i = 0;
  let changed = false;

  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    if (inFrontMatter) {
      if (i > 0 && t === '---') inFrontMatter = false;
      i++;
      continue;
    }

    if (isFence(line)) {
      inCode = !inCode;
      i++;
      continue;
    }
    if (inCode) {
      i++;
      continue;
    }

    // ATX headings
    const m = line.match(atxRe);
    if (m) {
      const leading = m[1];
      const hashes = m[2];
      const level = hashes.length; // 1..6
      const text = m[3].trim();

      // adjust stack to current level
      while (textStack.length > level) textStack.pop();
      while (textStack.length <= level) textStack.push(new Map());

      const map = textStack[level];
      const key = text.toLowerCase();
      const count = (map.get(key) || 0) + 1;
      map.set(key, count);
      if (count > 1) {
        const newText = `${text} (${count})`;
        lines[i] = `${leading}${hashes} ${newText}`;
        changed = true;
      }
      i++;
      continue;
    }

    // Setext headings: previous non-blank line is heading text
    if (setextUnderlineRe.test(line)) {
      // Find heading text line index in lines
      let j = i - 1;
      while (j >= 0 && lines[j].trim() === '') j--;
      if (j >= 0 && !isFence(lines[j])) {
        const textLine = lines[j];
        const text = textLine.trim();
        // Determine level: '=' => h1, '-' => h2
        const level = line.trim().startsWith('=') ? 1 : 2;
        while (textStack.length > level) textStack.pop();
        while (textStack.length <= level) textStack.push(new Map());
        const map = textStack[level];
        const key = text.toLowerCase();
        const count = (map.get(key) || 0) + 1;
        map.set(key, count);
        if (count > 1) {
          const newText = `${text} (${count})`;
          lines[j] = newText;
          changed = true;
        }
      }
      i++;
      continue;
    }

    i++;
  }

  if (changed) {
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    return true;
  }
  return false;
}

function main() {
  const files = [];
  walk(repoRoot, files);
  let changed = 0;
  for (const f of files) {
    try {
      if (processFile(f)) changed++;
    } catch (e) {
      console.error('Error:', f, e.message);
    }
  }
  console.log(`[fix-md024] Processed ${files.length} markdown files; renamed headings in ${changed}.`);
}

main();
