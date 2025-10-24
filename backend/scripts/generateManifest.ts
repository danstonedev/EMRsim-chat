#!/usr/bin/env tsx
/// <reference types="node" />
/**
 * Generate content manifest with versions and checksums
 * 
 * Usage:
 *   npm run manifest:generate
 *   npx tsx scripts/generateManifest.ts
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateContentArtifacts,
  saveCatalogAnalysis,
  saveDependencyManifest,
  saveManifest
} from '../src/sps/utils/manifestGenerator.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTENT_ROOT = path.resolve(__dirname, '../src/sps/content');
const OUTPUT_PATH = path.resolve(__dirname, '../src/sps/content/manifest.json');
const DEPENDENCY_OUTPUT_PATH = path.resolve(__dirname, '../src/sps/content/dependencies.json');
const CATALOG_ANALYSIS_OUTPUT_PATH = path.resolve(__dirname, '../src/sps/content/catalogs/report.json');

console.log('[manifest] Starting content manifest generation...');
console.log(`[manifest] Content root: ${CONTENT_ROOT}`);
console.log(`[manifest] Output path: ${OUTPUT_PATH}`);
console.log(`[manifest] Dependency output path: ${DEPENDENCY_OUTPUT_PATH}`);
console.log(`[manifest] Catalog analysis output path: ${CATALOG_ANALYSIS_OUTPUT_PATH}`);
console.log('');

try {
  const artifacts = generateContentArtifacts(CONTENT_ROOT);
  saveManifest(artifacts.manifest, OUTPUT_PATH);
  saveDependencyManifest(artifacts.dependencies, DEPENDENCY_OUTPUT_PATH);
  saveCatalogAnalysis(artifacts.catalogReport, CATALOG_ANALYSIS_OUTPUT_PATH);
  console.log('');
  console.log('[manifest] ✅ Manifest generation complete!');
  process.exit(0);
} catch (error) {
  console.error('[manifest] ❌ Error generating manifest:');
  console.error(error);
  process.exit(1);
}
