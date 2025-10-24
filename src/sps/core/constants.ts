/**
 * SPS Core Constants
 * 
 * This file contains constants used throughout the SPS system,
 * particularly paths to content assets.
 */

import path from 'path';

// Root content directory
const CONTENT_ROOT = path.join(__dirname, '../../content');

/**
 * Content directory paths
 */
export const CONTENT_PATHS = {
  // Runtime content (shipped in container)
  root: CONTENT_ROOT,
  personas: {
    realtime: path.join(CONTENT_ROOT, 'personas/realtime'),
    // shared/base deprecated and removed from runtime
  },
  scenarios: {
    compiled: path.join(CONTENT_ROOT, 'scenarios/compiled'),
  },
  banks: {
    challenges: path.join(CONTENT_ROOT, 'banks/challenges'),
    special_questions: path.join(CONTENT_ROOT, 'banks/special_questions'),
    catalogs: path.join(CONTENT_ROOT, 'banks/catalogs'),
    modules: path.join(CONTENT_ROOT, 'banks/modules'),
  },
  // Authoring content (excluded from container)
  authoring: {
    bundles_src: path.join(CONTENT_ROOT, 'authoring/bundles_src'),
    templates: path.join(CONTENT_ROOT, 'authoring/templates'),
  },
  // Manifests
  manifest: path.join(CONTENT_ROOT, 'manifest.json'),
  dependencies: path.join(CONTENT_ROOT, 'dependencies.json'),
};

/**
 * Feature flags
 */
export const FEATURES = {
  /**
   * Whether to use compiled scenarios or load from bundle sources
   */
  USE_COMPILED_SCENARIOS: process.env.SPS_USE_DYNAMIC_LOAD !== '1',
  
  /**
   * Whether to cache content in memory
   */
  ENABLE_CONTENT_CACHE: process.env.SPS_DISABLE_CACHE !== '1',
};
