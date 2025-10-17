#!/usr/bin/env node
// Scans public/models/animations/*.glb and writes src/.../manifest.generated.json
import { readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const animsDir = join(root, 'public', 'models', 'animations')
const outFile = join(root, 'src', 'pages', 'components', 'viewer', 'animations', 'manifest.generated.json')

const files = readdirSync(animsDir)
  .filter(f => f.toLowerCase().endsWith('.glb'))
  .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

const json = { files }
writeFileSync(outFile, JSON.stringify(json, null, 2), 'utf8')
console.log(`[scan-animations] Wrote ${files.length} files to ${outFile}`)
