# Phase 4 Implementation: Normalization & Module Libraries

**Date:** October 6, 2025  
**Status:** 🚧 In Progress  
**Goal:** Extract normalization logic and create reusable content libraries

## Overview

Phase 4 focuses on reducing duplication by extracting scenario normalization logic and creating shared module libraries that scenarios can reference by ID rather than embedding duplicate content.

## Current State Analysis

### Normalization Logic Location

Currently in `src/sps/runtime/session.ts`:

- `convertPersonaBundle()` - Lines ~328-430
- `convertScenarioBundle()` - Lines ~480-590
- `buildObjectiveFinding()` - Helper for objective data
- `buildObjectiveCatalog()` - Constructs objective findings
- Various mapping functions: `mapTone()`, `mapVerbosity()`, `mapSleepQuality()`

### Module Duplication

Scenarios contain embedded module files (e.g., `acute_care.module.json`) that could be deduplicated:
``` text
sc_hip_tha_anterior_pod0_v1/acute_care.module.json
sc_knee_acl_preop_direct_access_v1/acute_care.module.json
...potentially more
```

## Phase 4 Tasks

### Task 1: Normalization Extraction

**Goal:** Move normalization logic to dedicated module

**Actions:**

- [ ] Create `src/sps/core/normalization/` directory
- [ ] Extract conversion functions:
  - [ ] `normalizePersona()` - from `convertPersonaBundle()`
  - [ ] `normalizeScenario()` - from `convertScenarioBundle()`
  - [ ] `normalizeObjectiveFinding()` - from `buildObjectiveFinding()`
- [ ] Create unit tests for normalization functions
- [ ] Update `session.ts` to import from normalization module
- [ ] Verify all tests still pass

**Acceptance Criteria:**

- Normalization functions in separate testable module
- 100% test coverage for normalization logic
- No change to runtime behavior
- All existing tests pass

### Task 2: Module Library Analysis

**Goal:** Identify duplicate modules and create shared library

**Actions:**

- [ ] Scan all scenario bundles for module files
- [ ] Identify duplicate modules (same content, different locations)
- [ ] Create module catalog with checksums
- [ ] Design module reference format (ID-based)

**Analysis Script:**
```bash
# Find all module.json files
find src/sps/content/scenarios/bundles_src -name "*.module.json"

# Check for duplicates by content hash
find src/sps/content/scenarios/bundles_src -name "*.module.json" -exec md5sum {} \;
```

### Task 3: Module Library Implementation

**Goal:** Create shared module library and update scenarios to reference modules by ID

**Actions:**

- [ ] Create `src/sps/content/banks/modules/` directory
- [ ] Move unique modules to shared library with versioned IDs
- [ ] Create module registry/index
- [ ] Update scenario headers to reference module IDs instead of embedding
- [ ] Update scenario loader to resolve module references
- [ ] Update validation to check module references

**Example Structure:**
``` text
content/banks/modules/
  acute_care.v1.json          # Acute care workflow module
  mobility_assessment.v1.json # Mobility assessment module
  pain_assessment.v1.json     # Pain assessment module
  index.json                  # Module registry
```

**Scenario Reference Format:**
```json
{
  "linkage": {
    "modules": [
      { "id": "acute_care", "version": "v1" }
    ]
  }
}
```

### Task 4: Content Versioning

**Goal:** Add version metadata and checksums for cache invalidation

**Actions:**

- [ ] Add `content_version` field to personas
- [ ] Add `content_version` field to scenarios
- [ ] Generate SHA-256 checksums for all content files
- [ ] Create content manifest with versions and checksums
- [ ] Update API endpoints to include version headers
- [ ] Implement client-side cache invalidation based on versions

**Manifest Format:**
```json
{
  "generated_at": "2025-10-06T16:30:00Z",
  "content": {
    "personas": {
      "prsn_tha_pod0_v1": {
        "version": "1.0.0",
        "checksum": "sha256:abc123...",
        "updated_at": "2025-10-06T00:00:00Z"
      }
    },
    "scenarios": {
      "sc_hip_tha_anterior_pod0_v1": {
        "version": "1.0.0",
        "checksum": "sha256:def456...",
        "updated_at": "2025-10-06T00:00:00Z"
      }
    }
  }
}
```

### Task 5: Catalog Deduplication Analysis

**Goal:** Ensure catalogs are truly deduplicated after Phase 3 move

**Actions:**

- [ ] Audit all catalog files in `content/banks/catalogs/`
- [ ] Check for any remaining duplicates
- [ ] Verify no references to old `templates/catalogs/` paths
- [ ] Document catalog structure and purpose

## Testing Strategy

### Unit Tests

- Normalization functions in isolation
- Module resolution logic
- Checksum generation
- Version comparison

### Integration Tests

- Scenario loading with module references
- Version-based cache invalidation
- Manifest generation and validation

### E2E Tests

- Full scenario load with normalized data
- Client receives correct content versions
- Cache invalidation triggers properly

## Rollback Strategy

- Phase 4 changes are additive/refactoring
- No breaking changes to data formats (modules remain optional)
- Can revert normalization extraction by reverting imports
- Module library is opt-in (scenarios can still embed modules initially)

## Success Metrics

- [ ] Number of duplicate module files: **Target: 0**
- [ ] Lines of code in session.ts: **Target: <500** (currently ~660)
- [ ] Normalization test coverage: **Target: 100%**
- [ ] Content manifest generation time: **Target: <100ms**
- [ ] Scenario load time: **No regression** (within 5%)

## Timeline Estimate

- Task 1 (Normalization): 2-3 hours
- Task 2 (Analysis): 30 minutes
- Task 3 (Module Library): 2-4 hours
- Task 4 (Versioning): 2-3 hours
- Task 5 (Audit): 30 minutes

**Total Estimated: 7-11 hours**

## Next Steps

1. Start with Task 1 (Normalization Extraction) - lowest risk, highest value
2. Run Task 2 (Module Analysis) to understand scope
3. Decide on Task 3 implementation based on analysis results
4. Tasks 4-5 can be done in parallel or deferred

## Notes

- Keep Phase 2 (compilation) in mind - normalization extraction will make compilation easier
- Module library should be designed to support compilation pipeline
- Content versioning will be critical for production caching strategy
- Consider adding content migration tooling for future schema changes
