import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRequestLogger } from '../utils/requestContext.ts';

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
  special_tests: '../sps/content/banks/catalogs/tests/special_tests.library.json',
  functional_tests: '../sps/content/banks/catalogs/tests/functional_tests.library.json',
  interventions: '../sps/content/banks/catalogs/interventions/intervention_templates.library.json',
  outcomes: '../sps/content/banks/catalogs/outcomes/outcome_measures.library.json',
  rom_norms: '../sps/content/banks/catalogs/norms/rom_norms.library.json',
  safety: '../sps/content/banks/catalogs/safety/safety_thresholds.library.json',
  protocols: '../sps/content/banks/catalogs/protocols/protocol_sources.library.json',
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
      const log = getRequestLogger();
      log.info({ catalogType }, '[catalog-service] loaded catalog');
      return catalog;
    } catch (error) {
      const log = getRequestLogger();
      log.error({ catalogType, error }, '[catalog-service] failed to load catalog');
      throw new Error(`Failed to load catalog: ${catalogType}`);
    }
  }

  // Preload all catalogs at startup for better performance
  async preloadAll(): Promise<void> {
    const log = getRequestLogger();
    log.info('[catalog-service] preloading all catalogs...');
    const catalogTypes: CatalogType[] = [
      'special_tests',
      'functional_tests',
      'interventions',
      'outcomes',
      'rom_norms',
      'safety',
      'protocols',
    ];

    await Promise.all(
      catalogTypes.map(type =>
        this.getCatalog(type).catch(err => {
          const l = getRequestLogger();
          l.warn({ catalogType: type, error: err?.message }, '[catalog-service] failed to preload');
        })
      )
    );

    log.info('[catalog-service] preloading complete');
  }

  // Clear cache (useful for testing or hot-reload scenarios)
  clearCache(): void {
    this.cache.clear();
    const log = getRequestLogger();
    log.info('[catalog-service] cache cleared');
  }
}

export const catalogService = new CatalogService();
