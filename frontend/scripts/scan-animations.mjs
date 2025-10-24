#!/usr/bin/env node
// Scans public/models/animations/*.glb and writes src/.../manifest.generated.json
import { readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { cwd } from 'node:process'

const root = cwd()
const animsDir = join(root, 'public', 'models', 'animations')
const outFile = join(root, 'src', 'pages', 'components', 'viewer', 'animations', 'manifest.generated.json')

function safeScan(dir) {
  if (!existsSync(dir)) {
    console.warn(`[scan-animations] WARNING: Directory not found: ${dir}. Writing empty manifest.`)
    return []
  }
  try {
    const list = readdirSync(dir)
      .filter(f => f.toLowerCase().endsWith('.glb'))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

    // Detect duplicates ignoring case
    const seen = new Map()
    const dups = []
    for (const f of list) {
      const key = f.toLowerCase()
      if (seen.has(key)) dups.push(f)
      else seen.set(key, true)
    }
    if (dups.length) {
      console.warn(`[scan-animations] WARNING: Duplicate filenames detected (case-insensitive): ${dups.join(', ')}`)
    }

    return list
  } catch (err) {
    console.warn(`[scan-animations] WARNING: Failed to read ${dir}:`, err?.message || err)
    return []
  }
}

const files = safeScan(animsDir)

// Ensure output directory exists
const outDir = dirname(outFile)
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true })
}

const json = { files }
writeFileSync(outFile, JSON.stringify(json, null, 2), 'utf8')
console.log(`[scan-animations] Wrote ${files.length} files to ${outFile}`)
