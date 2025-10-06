import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type CatalogType =
  | 'special_tests'
  | 'functional_tests'
  | 'interventions'
  | 'outcomes'
  | 'rom_norms'
  | 'safety'
  | 'protocols';

interface CatalogMap {
  special_tests: { tests: any[] };
  functional_tests: { tests: any[] };
  interventions: { interventions: any[] };
  outcomes: { outcomes: any[] };
  rom_norms: { norms: any[] };
  safety: { thresholds: any[] };
  protocols: { protocols: any[] };
}

const CATALOG_PATHS: Record<CatalogType, string> = {
  special_tests: '../sps/data/catalogs/tests/special_tests.library.json',
  functional_tests: '../sps/data/catalogs/tests/functional_tests.library.json',
  interventions: '../sps/data/catalogs/interventions/intervention_templates.library.json',
  outcomes: '../sps/data/catalogs/outcomes/outcome_measures.library.json',
  rom_norms: '../sps/data/catalogs/norms/rom_norms.library.json',
  safety: '../sps/data/catalogs/safety/safety_thresholds.library.json',
  protocols: '../sps/data/catalogs/protocols/protocol_sources.library.json',
};

class CatalogService {
  private cache = new Map<CatalogType, any>();
  private loadingPromises = new Map<CatalogType, Promise<any>>();

  async getCatalog<T extends CatalogType>(catalogType: T): Promise<CatalogMap[T]> {
    // Return from cache if available
    if (this.cache.has(catalogType)) {
      return this.cache.get(catalogType);
    }

    // If already loading, return the existing promise
    if (this.loadingPromises.has(catalogType)) {
      return this.loadingPromises.get(catalogType);
    }

    // Start loading
    const loadPromise = this.loadCatalog(catalogType);
    this.loadingPromises.set(catalogType, loadPromise);

    try {
      const data = await loadPromise;
      this.cache.set(catalogType, data);
      return data;
    } finally {
      this.loadingPromises.delete(catalogType);
    }
  }

  private async loadCatalog<T extends CatalogType>(catalogType: T): Promise<CatalogMap[T]> {
    const relativePath = CATALOG_PATHS[catalogType];
    const catalogPath = path.join(__dirname, relativePath);

    try {
      const fileContent = await readFile(catalogPath, 'utf8');
      const catalog = JSON.parse(fileContent);
      console.log(`[catalog-service] Loaded ${catalogType} catalog`);
      return catalog;
    } catch (error) {
      console.error(`[catalog-service] Failed to load ${catalogType}:`, error);
      throw new Error(`Failed to load catalog: ${catalogType}`);
    }
  }

  // Preload all catalogs at startup for better performance
  async preloadAll(): Promise<void> {
    console.log('[catalog-service] Preloading all catalogs...');
    const catalogTypes: CatalogType[] = [
      'special_tests',
      'functional_tests',
      'interventions',
      'outcomes',
      'rom_norms',
      'safety',
      'protocols',
    ];

    await Promise.all(catalogTypes.map(type => this.getCatalog(type).catch(err => {
      console.warn(`[catalog-service] Failed to preload ${type}:`, err.message);
    })));

    console.log('[catalog-service] Preloading complete');
  }

  // Clear cache (useful for testing or hot-reload scenarios)
  clearCache(): void {
    this.cache.clear();
    console.log('[catalog-service] Cache cleared');
  }
}

export const catalogService = new CatalogService();
