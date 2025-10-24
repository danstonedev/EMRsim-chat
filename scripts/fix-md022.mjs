#!/usr/bin/env node
// Markdown hygiene fixer
// Fixes:
// - MD022: Headings must be surrounded by one blank line
// - MD032: Lists must be surrounded by one blank line
// - MD040: Fenced code blocks should have a language (adds 'text' when missing)
// - MD007 (minimal): Convert leading tabs to spaces in list items and normalize single space after marker
// Reports (no in-place fix):
// - MD024: Duplicate headings in the same file

import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'playwright-report',
  'test-results',
]);

function isMarkdown(file) {
  return file.toLowerCase().endsWith('.md');
}

function walkDir(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.DS_Store')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      walkDir(full, out);
    } else if (entry.isFile() && isMarkdown(entry.name)) {
      out.push(full);
    }
  }
}

function isFence(line) {
  const t = line.trim();
  return (t.startsWith('```') || t.startsWith('~~~')) && !t.startsWith('````') && !t.startsWith('~~~~');
}

function normalizeListItem(line) {
  // Minimal MD007-safe normalization: replace tabs with two spaces in indent and single space after marker
  const m = line.match(/^(\s*)([-+*]|\d+\.)(\s+)(.*)$/);
  if (!m) return line;
  const indent = m[1].replace(/\t/g, '  ');
  const marker = m[2];
  const rest = m[4].replace(/^\s+/, ' ');
  return indent + marker + ' ' + rest;
}

function hasFenceLanguage(line) {
  const t = line.trim();
  // Matches ```lang or ~~~lang (where lang starts with a letter or common symbols like bash/sh)
  return /^(```|~~~)\s*[^`~\s]/.test(t);
}

function listItemTest(line) {
  return /^\s*(?:[-+*]|\d+\.)\s+.+$/.test(line);
}

function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  const lines = original.split(/\r?\n/);
  const out = [];

  let i = 0;
  let inCode = false;
  let inFrontMatter = false;
  // YAML front matter detection at start only
  if (lines[0] && lines[0].trim() === '---') {
    inFrontMatter = true;
  }

  const atxRe = /^ {0,3}#{1,6}(\s|$)/; // ATX heading start
  const setextRe = /^ {0,3}(=+|-+)\s*$/; // Setext underline

  // For MD024 reporting
  const headingTexts = new Map(); // text -> array of line numbers

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Toggle front matter off at closing '---' (only if we started in front matter)
    if (inFrontMatter) {
      out.push(line);
      if (i > 0 && trimmed === '---') {
        inFrontMatter = false;
      }
      i++;
      continue;
    }

    // Toggle code fences
    if (isFence(line)) {
      inCode = !inCode;
      out.push(line);
      i++;
      continue;
    }

    if (!inCode && atxRe.test(line)) {
      // Normalize blank lines BEFORE
      let j = out.length - 1;
      // remove extra blank lines before
      while (j >= 0 && out[j].trim() === '') {
        out.pop();
        j--;
      }
      if (out.length > 0) {
        out.push('');
      }
      // Write heading line
      out.push(line);

      // Normalize blank lines AFTER
      // Skip over blank lines following heading in source
      let k = i + 1;
      while (k < lines.length && lines[k].trim() === '') k++;
      // If there is more content after the heading, ensure a single blank line
      if (k < lines.length) {
        out.push('');
      }
      // MD024 collection: compute heading text
      const text = line.replace(/^\s*#{1,6}\s*/, '').replace(/\s*#+\s*$/, '').trim().toLowerCase();
      const arr = headingTexts.get(text) || [];
      arr.push(i + 1);
      headingTexts.set(text, arr);
      i = i + 1; // continue with next line (k is only for lookahead)
      continue;
    }

    if (!inCode && setextRe.test(line)) {
      // Potential Setext underline. Validate previous output line is the heading text (non-blank)
      if (out.length === 0 || out[out.length - 1].trim() === '') {
        // Not a valid setext pair (could be hr or stray dashes) -> write as-is
        out.push(line);
        i++;
        continue;
      }

      // Normalize blank lines BEFORE the heading text
      let idx = out.length - 1; // heading text line index
      // Remove surplus blank lines immediately before heading text
      while (idx - 1 >= 0 && out[idx - 1].trim() === '') {
        out.splice(idx - 1, 1);
        idx--;
      }
      if (idx > 0 && out[idx - 1].trim() !== '') {
        out.splice(idx, 0, '');
        idx++;
      }
      // Now add the underline
      out.push(line);

      // Normalize blank lines AFTER underline
      let k = i + 1;
      while (k < lines.length && lines[k].trim() === '') k++;
      if (k < lines.length) {
        out.push('');
      }
      // MD024 collection: derive heading text from prior line
      const headingLine = out[idx - 1] || '';
      const text = headingLine.trim().toLowerCase();
      const arr = headingTexts.get(text) || [];
      arr.push(i); // underline line index approximates heading
      headingTexts.set(text, arr);
      i = i + 1;
      continue;
    }

    // Default: passthrough (with minimal list normalization for MD007)
    if (!inCode && listItemTest(line)) {
      out.push(normalizeListItem(line));
    } else {
      out.push(line);
    }
    i++;
  }

  // PASS 2: MD040 add language to opening code fences if missing; MD032 ensure blank lines around lists
  const out2 = [];
  inCode = false;
  let lastNonBlankWasList = false;
  for (let idx = 0; idx < out.length; idx++) {
    let ln = out[idx];
    const t = ln.trim();

    if (isFence(ln)) {
      if (!inCode) {
        // opening fence
        if (!hasFenceLanguage(ln)) {
          const fence = t.startsWith('~~~') ? '~~~' : '```';
          ln = fence + ' text';
        }
        inCode = true;
      } else {
        // closing fence
        inCode = false;
      }
      // Fences inherently break list context
      if (out2.length && out2[out2.length - 1].trim() !== '') {
        lastNonBlankWasList = false;
      }
      out2.push(ln);
      continue;
    }

    if (inCode) {
      out2.push(ln);
      continue;
    }

    const isBlank = t === '';
    const isList = listItemTest(ln);

    // MD032: Ensure one blank line BEFORE a list block
    if (isList) {
      // If previous non-blank in output exists and is not a list, ensure exactly one blank line
      let p = out2.length - 1;
      while (p >= 0 && out2[p].trim() === '') p--;
      const prevNonBlank = p >= 0 ? out2[p] : null;
      const prevWasList = prevNonBlank ? listItemTest(prevNonBlank) : false;
      if (!prevWasList && prevNonBlank !== null) {
        if (p >= 0 && out2[p + 1] !== '') {
          out2.splice(p + 1, 0, '');
        }
        // compress any additional blanks after insertion
        while (out2.length - (p + 2) > 0 && out2[p + 2] === '') {
          out2.splice(p + 2, 1);
        }
      }
    }

    // Write current line (compress multiple blanks anywhere)
    if (isBlank) {
      if (out2.length === 0 || out2[out2.length - 1] === '') {
        // skip extra blank
      } else {
        out2.push('');
      }
    } else {
      out2.push(ln);
    }

    // MD032: Ensure one blank line AFTER a list block
    if (isList) {
      // Look ahead to next non-blank, non-code line in out (we still have original out lines to peek from)
      let k = idx + 1;
      while (k < out.length && out[k].trim() === '') k++;
      const nextExists = k < out.length;
      const nextIsList = nextExists ? listItemTest(out[k]) : false;
      if (nextExists && !nextIsList) {
        if (out2[out2.length - 1] !== '') out2.push('');
      }
      lastNonBlankWasList = true;
    } else if (!isBlank) {
      lastNonBlankWasList = false;
    }
  }

  const result = out2.join('\n');
  if (result !== original) {
    fs.writeFileSync(filePath, result, 'utf8');
    // MD024 reporting for this file (only if changed or always?)
    for (const [text, arr] of headingTexts.entries()) {
      if (text && arr.length > 1) {
        console.log(`[md024] duplicate heading in ${path.relative(repoRoot, filePath)}: "${text}" at lines ${arr.join(', ')}`);
      }
    }
    return true;
  }
  return false;
}

function main() {
  const files = [];
  walkDir(repoRoot, files);
  let changed = 0;
  for (const f of files) {
    try {
      if (processFile(f)) changed++;
    } catch (err) {
      console.error(`Error processing ${f}:`, err.message);
    }
  }
  console.log(`[fix-md022] Processed ${files.length} markdown files; updated ${changed}.`);
}

main();
