# Phase 4 Task 4: Content Versioning - Analysis

**Date:** October 6, 2025  
**Status:** 🔍 Analysis Complete  
**Goal:** Add version metadata and checksums for cache invalidation

---

## Current State Analysis

### Content Structure

#### Personas
- **Location**: `src/sps/content/personas/base/`
- **Format**: Single JSON files (e.g., `linda.json`, `chloe.json`)
- **Current Metadata**:
  - `patient_id` (e.g., `sp_persona_linda_v1`)
  - Demographics, social context, beliefs, dialogue style
  - **NO version field currently**

#### Scenarios
- **Location**: `src/sps/content/scenarios/bundles_src/`
- **Format**: Directory bundles with `scenario.header.json`
- **Current Metadata** (in `scenario.header.json`):
  - `schema_version`: "3.0.0"
  - `scenario_id`: e.g., "sc_hip_tha_anterior_pod0_v1"
  - `version`: 1 (integer, not semantic version)
  - `status`: "published"
  - `meta`: title, region, difficulty, tags, timestamps
  - `linkage`: references to persona, SOAP files, modules
  - `pedagogy`: learning objectives, rubric info
  - **HAS version field but not semantic versioning**

### Findings

1. **Personas lack version metadata** - Need to add `content_version` field
2. **Scenarios use integer version** - Should migrate to semantic versioning
3. **No checksums anywhere** - Need to generate SHA-256 checksums
4. **No centralized manifest** - Need content registry for version tracking
5. **API responses don't include version headers** - Need ETags for cache invalidation

---

## Versioning Schema Design

### Semantic Versioning Format

Use **semantic versioning** (SemVer) for all content:
```
MAJOR.MINOR.PATCH
```

- **MAJOR**: Breaking changes (e.g., schema changes, removed fields)
- **MINOR**: New features (e.g., added learning objectives, new SOAP sections)
- **PATCH**: Bug fixes, typo corrections, minor content updates

**Initial Version**: `1.0.0` for all existing content

### Checksum Algorithm

Use **SHA-256** for file integrity:
- For single-file personas: Hash of JSON file content
- For directory-based scenarios: Composite hash of all bundle files
  - Hash each file individually
  - Concatenate hashes in sorted order
  - Hash the concatenated string for bundle checksum

### Manifest Structure

**File**: `src/sps/content/manifest.json`

```json
{
  "schema_version": "1.0.0",
  "generated_at": "2025-10-06T20:30:00Z",
  "generator": "sps-manifest-generator",
  "content": {
    "personas": {
      "linda": {
        "content_version": "1.0.0",
        "file": "personas/base/linda.json",
        "checksum": "sha256:abc123...",
        "updated_at": "2025-10-06T00:00:00Z",
        "patient_id": "sp_persona_linda_v1"
      },
      "chloe": {
        "content_version": "1.0.0",
        "file": "personas/base/chloe.json",
        "checksum": "sha256:def456...",
        "updated_at": "2025-10-06T00:00:00Z",
        "patient_id": "sp_persona_chloe_v1"
      }
    },
    "scenarios": {
      "sc_hip_tha_anterior_pod0_v1": {
        "content_version": "1.0.0",
        "bundle_dir": "scenarios/bundles_src/sc_hip_tha_anterior_pod0_v1",
        "checksum": "sha256:ghi789...",
        "updated_at": "2025-10-01T16:57:26Z",
        "schema_version": "3.0.0",
        "status": "published"
      }
    },
    "modules": {
      "acute_care_total_joint": {
        "v1": {
          "content_version": "1.0.0",
          "file": "banks/modules/acute_care_total_joint.v1.json",
          "checksum": "sha256:3eb3d82...",
          "updated_at": "2025-10-06T00:00:00Z"
        }
      }
    }
  },
  "statistics": {
    "total_personas": 4,
    "total_scenarios": 3,
    "total_modules": 3,
    "total_files_tracked": 10
  }
}
```

---

## Implementation Plan

### Step 1: Add Version Fields

#### Personas
Add `content_version` field to each persona JSON:
```json
{
  "content_version": "1.0.0",
  "patient_id": "sp_persona_linda_v1",
  "demographics": { ... }
}
```

#### Scenarios
Update `version` field in `scenario.header.json` to semantic version:
```json
{
  "schema_version": "3.0.0",
  "scenario_id": "sc_hip_tha_anterior_pod0_v1",
  "content_version": "1.0.0",  // NEW: semantic version
  "version": 1,                 // KEEP: for backward compatibility
  "status": "published",
  ...
}
```

### Step 2: Checksum Utility

Create `src/sps/utils/checksum.ts`:
```typescript
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Generate SHA-256 checksum for file
 */
export function generateFileChecksum(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Generate composite checksum for directory bundle
 */
export function generateBundleChecksum(bundleDir: string): string {
  const files = fs.readdirSync(bundleDir)
    .filter(f => f.endsWith('.json'))
    .sort(); // Consistent ordering
  
  const checksums = files.map(f => 
    generateFileChecksum(path.join(bundleDir, f))
  );
  
  const composite = checksums.join('');
  return crypto.createHash('sha256').update(composite).digest('hex');
}

/**
 * Generate SHA-256 checksum for object (JSON serialized)
 */
export function generateObjectChecksum(obj: any): string {
  const json = JSON.stringify(obj, null, 0); // Compact
  return crypto.createHash('sha256').update(json).digest('hex');
}
```

### Step 3: Manifest Generator

Create `src/sps/utils/manifestGenerator.ts`:
```typescript
import fs from 'fs';
import path from 'path';
import { generateFileChecksum, generateBundleChecksum } from './checksum';

interface ContentManifest {
  schema_version: string;
  generated_at: string;
  generator: string;
  content: {
    personas: Record<string, PersonaManifestEntry>;
    scenarios: Record<string, ScenarioManifestEntry>;
    modules: Record<string, ModuleManifestEntry>;
  };
  statistics: {
    total_personas: number;
    total_scenarios: number;
    total_modules: number;
    total_files_tracked: number;
  };
}

export function generateContentManifest(contentRoot: string): ContentManifest {
  const manifest: ContentManifest = {
    schema_version: '1.0.0',
    generated_at: new Date().toISOString(),
    generator: 'sps-manifest-generator',
    content: {
      personas: {},
      scenarios: {},
      modules: {}
    },
    statistics: {
      total_personas: 0,
      total_scenarios: 0,
      total_modules: 0,
      total_files_tracked: 0
    }
  };

  // Scan personas
  const personasDir = path.join(contentRoot, 'personas/base');
  const personaFiles = fs.readdirSync(personasDir).filter(f => f.endsWith('.json'));
  
  for (const file of personaFiles) {
    const filePath = path.join(personasDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const personaKey = path.basename(file, '.json');
    
    manifest.content.personas[personaKey] = {
      content_version: data.content_version || '1.0.0',
      file: `personas/base/${file}`,
      checksum: `sha256:${generateFileChecksum(filePath)}`,
      updated_at: data.updated_at || new Date().toISOString(),
      patient_id: data.patient_id
    };
    manifest.statistics.total_personas++;
  }

  // Scan scenarios
  const scenariosDir = path.join(contentRoot, 'scenarios/bundles_src');
  const scenarioDirs = fs.readdirSync(scenariosDir).filter(f => 
    fs.statSync(path.join(scenariosDir, f)).isDirectory()
  );
  
  for (const dir of scenarioDirs) {
    const bundleDir = path.join(scenariosDir, dir);
    const headerPath = path.join(bundleDir, 'scenario.header.json');
    
    if (!fs.existsSync(headerPath)) continue;
    
    const header = JSON.parse(fs.readFileSync(headerPath, 'utf-8'));
    
    manifest.content.scenarios[dir] = {
      content_version: header.content_version || '1.0.0',
      bundle_dir: `scenarios/bundles_src/${dir}`,
      checksum: `sha256:${generateBundleChecksum(bundleDir)}`,
      updated_at: header.meta?.updated_at || new Date().toISOString(),
      schema_version: header.schema_version,
      status: header.status
    };
    manifest.statistics.total_scenarios++;
  }

  // Scan modules
  const modulesDir = path.join(contentRoot, 'banks/modules');
  if (fs.existsSync(modulesDir)) {
    const moduleFiles = fs.readdirSync(modulesDir).filter(f => f.endsWith('.json') && f !== 'index.json');
    
    for (const file of moduleFiles) {
      const match = file.match(/^(.+)\.(v\d+)\.json$/);
      if (!match) continue;
      
      const [, moduleId, version] = match;
      const filePath = path.join(modulesDir, file);
      
      if (!manifest.content.modules[moduleId]) {
        manifest.content.modules[moduleId] = {};
      }
      
      manifest.content.modules[moduleId][version] = {
        content_version: '1.0.0',
        file: `banks/modules/${file}`,
        checksum: `sha256:${generateFileChecksum(filePath)}`,
        updated_at: new Date().toISOString()
      };
      manifest.statistics.total_modules++;
    }
  }

  manifest.statistics.total_files_tracked = 
    manifest.statistics.total_personas +
    manifest.statistics.total_scenarios +
    manifest.statistics.total_modules;

  return manifest;
}

export function saveManifest(manifest: ContentManifest, outputPath: string): void {
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf-8');
}
```

### Step 4: API Response Headers

Update controllers to include version headers:

**`src/controllers/personaController.ts`:**
```typescript
export const getPersona = async (req: Request, res: Response) => {
  const persona = await loadPersona(req.params.id);
  
  // Add version headers
  res.setHeader('X-Content-Version', persona.content_version || '1.0.0');
  res.setHeader('ETag', `"${persona.patient_id}-${persona.content_version}"`);
  res.setHeader('Cache-Control', 'private, max-age=3600, must-revalidate');
  
  res.json(persona);
};
```

**`src/controllers/scenarioController.ts`:**
```typescript
export const getScenario = async (req: Request, res: Response) => {
  const scenario = await loadScenario(req.params.id);
  
  // Add version headers
  res.setHeader('X-Content-Version', scenario.content_version || '1.0.0');
  res.setHeader('ETag', `"${scenario.scenario_id}-${scenario.content_version}"`);
  res.setHeader('Cache-Control', 'private, max-age=3600, must-revalidate');
  
  res.json(scenario);
};
```

### Step 5: Client-Side Cache Invalidation

Frontend should check ETag headers:
```typescript
// Example fetch with cache validation
async function fetchPersona(personaId: string) {
  const cachedVersion = localStorage.getItem(`persona-${personaId}-version`);
  
  const response = await fetch(`/api/personas/${personaId}`, {
    headers: cachedVersion ? { 'If-None-Match': `"${cachedVersion}"` } : {}
  });
  
  if (response.status === 304) {
    // Use cached data
    return JSON.parse(localStorage.getItem(`persona-${personaId}-data`)!);
  }
  
  const data = await response.json();
  const version = response.headers.get('X-Content-Version');
  
  // Update cache
  localStorage.setItem(`persona-${personaId}-version`, version!);
  localStorage.setItem(`persona-${personaId}-data`, JSON.stringify(data));
  
  return data;
}
```

---

## Files to Modify

### Add `content_version` Field
- `src/sps/content/personas/base/linda.json`
- `src/sps/content/personas/base/chloe.json`
- `src/sps/content/personas/base/irene.json`
- `src/sps/content/personas/base/rafa.json`
- `src/sps/content/scenarios/bundles_src/sc_hip_tha_anterior_pod0_v1/scenario.header.json`
- `src/sps/content/scenarios/bundles_src/sc_lumbar_clbp_ext_pref_flare_v1/scenario.header.json`
- `src/sps/content/scenarios/bundles_src/sc_knee_acl_preop_direct_access_v1/scenario.header.json`

### Create New Files
- `src/sps/utils/checksum.ts` - Checksum generation utilities
- `src/sps/utils/manifestGenerator.ts` - Manifest generation logic
- `src/sps/content/manifest.json` - Generated content manifest (gitignored, generated on build)
- `scripts/generateManifest.ts` - CLI script to generate manifest

### Modify Existing Files
- `src/controllers/personaController.ts` - Add version headers
- `src/controllers/scenarioController.ts` - Add version headers
- `package.json` - Add manifest generation to build script

---

## Testing Strategy

### Unit Tests

**`tests/checksum.test.ts`:**
- Test SHA-256 generation for files
- Test composite bundle checksums
- Test checksum stability (same input = same output)

**`tests/manifestGenerator.test.ts`:**
- Test manifest generation completeness
- Test checksum calculation
- Test statistics accuracy
- Test manifest schema validation

### Integration Tests

**`tests/versionHeaders.test.ts`:**
- Test API responses include version headers
- Test ETag format correctness
- Test Cache-Control headers

### E2E Tests

**`e2e/cache-invalidation.spec.ts`:**
- Test client cache behavior
- Test 304 Not Modified responses
- Test version change detection

---

## Rollback Strategy

1. **Version fields are additive** - Old code ignores new fields
2. **Manifest generation is opt-in** - Not required for runtime
3. **API headers don't break clients** - Headers are informational
4. **Can revert all changes** - No breaking changes to data schemas

---

## Success Metrics

- [ ] All personas have `content_version` field
- [ ] All scenarios have `content_version` field
- [ ] Manifest generator produces valid manifest
- [ ] All checksums are SHA-256 format
- [ ] API responses include `X-Content-Version` and `ETag` headers
- [ ] Manifest generation time < 100ms
- [ ] Zero test failures

---

## Next Steps

1. Add `content_version` to all persona files (4 files)
2. Add `content_version` to all scenario headers (3 files)
3. Create checksum utility module
4. Create manifest generator
5. Update API controllers with version headers
6. Create manifest generation script
7. Add tests
8. Update build process to auto-generate manifest

---

## Timeline Estimate

- Add version fields: 30 minutes
- Create checksum utility: 45 minutes
- Create manifest generator: 1 hour
- Update API controllers: 30 minutes
- Testing: 1 hour
- Documentation: 30 minutes

**Total: ~4.5 hours**
