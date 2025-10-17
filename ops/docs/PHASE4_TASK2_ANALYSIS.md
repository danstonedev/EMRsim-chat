# Phase 4 Task 2: Module Library Analysis

**Created:** October 6, 2025  
**Status:** Analysis Complete

---

## Executive Summary

Analyzed 3 scenario bundles containing 3 unique module files. Modules provide specialized clinical context data (acute care workflows, primary care assessment, sports PT criteria). Currently referenced via relative file paths in scenario headers. Ready for extraction to shared library.

## Implementation Update (Oct 7, 2025)

- ✅ Removed legacy `*.module.json` duplicates from scenario bundles
- ✅ Scenario headers now rely exclusively on shared module registry references (`module_id` + `version`)
- ✅ `sps:validate` enforces module resolution and flags deprecated string references
- ✅ Scenario conversion merges resolved modules into `scenario_context`
- ✅ Shared library (`content/banks/modules`) remains source of truth for module payloads

---

## Module Inventory

### 1. Acute Care Module

**File:** `acute_care.module.json`  
**Module ID:** `acute_care_total_joint_generic`  
**Used in:** `sc_hip_tha_anterior_pod0_v1`  
**Checksum:** `3EB3D82553526DE8E0A07D34265FCB65C2BB7E9D2C7DB7FBDEABFECFAD435D68`  
**Size:** 62 lines

**Purpose:** Post-operative acute care context for total joint replacement  
**Key Data:**

- Post-op day, procedure type, surgical approach
- Weight-bearing status, joint precautions
- Lines/tubes/drains inventory
- Mobility orders and pain management protocols
- DVT/PE prophylaxis details
- Incision status, hemodynamic limits
- Discharge milestones and planning

**Clinical Domains:**

- Acute care nursing
- Post-surgical rehabilitation
- Hospital discharge planning

---

### 2. Primary Spine Module

**File:** `primary_spine.module.json`  
**Module ID:** `primary_care_low_back_pain`  
**Used in:** `sc_lumbar_clbp_ext_pref_flare_v1`  
**Checksum:** `561FDA0DC994FAFB9DBF94BFE8115C15DBF181D4181E1E10586A3671D6261AA1`  
**Size:** 41 lines

**Purpose:** Primary care low back pain assessment context  
**Key Data:**

- LBP classification (nonspecific)
- Psychosocial screening scores (STarT Back, FABQ, PCS)
- Directional preference and centralization patterns
- Neurological examination details (SLR, myotomes, reflexes)
- Red flag screening (saddle anesthesia, bladder/bowel)
- Imaging appropriateness criteria
- Education intervention seeds

**Clinical Domains:**

- Primary care musculoskeletal
- Pain science and psychosocial factors
- Evidence-based imaging guidelines

---

### 3. Sports PT Module

**File:** `sports.module.json`  
**Module ID:** `sports_pt_generic`  
**Used in:** `sc_knee_acl_preop_direct_access_v1`  
**Checksum:** `1A2B0A8A50137DFD870CCD27E9FFF2E47D56383FC5CDD50985DC0C0E7303ECAF`  
**Size:** 28 lines

**Purpose:** Sports rehabilitation and return-to-sport context  
**Key Data:**

- Sport type, position, competition level
- Season phase (in-season, off-season)
- Workload metrics (acute/chronic load, volume indicators)
- Criterion-based testing batteries (hop tests, Y-balance, isokinetic)
- Readiness indicators (ACL-RSI)
- Clearance checklist framework

**Clinical Domains:**

- Sports physical therapy
- Return-to-play decision-making
- Injury prevention and load management

---

## Current Reference Pattern

### Scenario Header Linkage Format

```json
{
  "linkage": {
    "persona_id": "prsn_tha_pod0_v1",
    "instructions_file": "./instructions.json",
    "soap_subjective_file": "./soap.subjective.json",
    "soap_objective_file": "./soap.objective.json",
    "soap_assessment_file": "./soap.assessment.json",
    "soap_plan_file": "./soap.plan.json",
    "active_context_modules": [
      "./acute_care.module.json"
    ]
  }
}
```

**Current Behavior:**

- Modules referenced via relative file paths
- Loaded from same directory as scenario bundle
- No version control or checksums
- No module reusability across scenarios

---

## Proposed Module Library Structure

### Directory Layout

```text
src/sps/content/banks/modules/
  README.md                           # Module library documentation
  index.json                          # Module registry with metadata
  acute_care_total_joint.v1.json     # Acute care module (versioned)
  primary_care_low_back_pain.v1.json # Primary spine module (versioned)
  sports_pt_generic.v1.json          # Sports PT module (versioned)
```

### Module Registry Format (`index.json`)

```json
{
  "schema_version": "1.0.0",
  "generated_at": "2025-10-06T17:00:00Z",
  "modules": {
    "acute_care_total_joint": {
      "versions": {
        "v1": {
          "file": "acute_care_total_joint.v1.json",
          "checksum": "sha256:3EB3D82553526DE8E0A07D34265FCB65...",
          "description": "Post-operative acute care context for total joint replacement",
          "clinical_domains": ["acute_care", "post_surgical", "discharge_planning"],
          "created_at": "2025-10-06T00:00:00Z",
          "status": "stable"
        }
      },
      "latest": "v1"
    },
    "primary_care_low_back_pain": {
      "versions": {
        "v1": {
          "file": "primary_care_low_back_pain.v1.json",
          "checksum": "sha256:561FDA0DC994FAFB9DBF94BFE8115C15...",
          "description": "Primary care low back pain assessment context",
          "clinical_domains": ["primary_care", "pain_science", "imaging_guidelines"],
          "created_at": "2025-10-06T00:00:00Z",
          "status": "stable"
        }
      },
      "latest": "v1"
    },
    "sports_pt_generic": {
      "versions": {
        "v1": {
          "file": "sports_pt_generic.v1.json",
          "checksum": "sha256:1A2B0A8A50137DFD870CCD27E9FFF2E4...",
          "description": "Sports rehabilitation and return-to-sport context",
          "clinical_domains": ["sports_pt", "return_to_play", "load_management"],
          "created_at": "2025-10-06T00:00:00Z",
          "status": "stable"
        }
      },
      "latest": "v1"
    }
  }
}
```

### Updated Scenario Reference Format

```json
{
  "linkage": {
    "persona_id": "prsn_tha_pod0_v1",
    "instructions_file": "./instructions.json",
    "soap_subjective_file": "./soap.subjective.json",
    "soap_objective_file": "./soap.objective.json",
    "soap_assessment_file": "./soap.assessment.json",
    "soap_plan_file": "./soap.plan.json",
    "active_context_modules": [
      {
        "module_id": "acute_care_total_joint",
        "version": "v1"
      }
    ]
  }
}
```

**Benefits:**

- Modules referenced by ID, not file path
- Version pinning for stability
- Checksum verification for integrity
- Module reusability across scenarios
- Clear upgrade path (v1 → v2)

---

## Module Usage Patterns

### Module Loading Workflow

1. **Scenario Loader** reads scenario header
2. **Module References** extracted from `active_context_modules`
3. **Module Registry** consulted for file path + checksum
4. **Module File** loaded from shared library
5. **Checksum Verified** against registry
6. **Module Data** merged into scenario context

### Module Resolution Algorithm

```typescript
function resolveModule(moduleRef: ModuleReference): ModuleData {
  const { module_id, version } = moduleRef;
  const registry = loadModuleRegistry();
  
  const moduleEntry = registry.modules[module_id];
  if (!moduleEntry) {
    throw new Error(`Module not found: ${module_id}`);
  }
  
  const versionEntry = version 
    ? moduleEntry.versions[version]
    : moduleEntry.versions[moduleEntry.latest];
    
  if (!versionEntry) {
    throw new Error(`Version ${version} not found for module ${module_id}`);
  }
  
  const modulePath = path.join(MODULE_LIBRARY_PATH, versionEntry.file);
  const moduleData = loadJsonFile(modulePath);
  

  // Verify checksum

  const actualChecksum = calculateChecksum(moduleData);
  if (actualChecksum !== versionEntry.checksum) {
    throw new Error(`Checksum mismatch for ${module_id}@${version}`);
  }
  

  return moduleData;

}
```

---

## Module Duplication Analysis

### Duplicate Detection

No duplicate modules detected. All 3 modules have unique:

- Module IDs
- Content (different checksums)
- Clinical domains
- Use cases

### Shared Library Candidates

**All 3 modules qualify for shared library:**

- ✅ Well-defined clinical domains
- ✅ Reusable across similar scenarios
- ✅ Stable structure (no frequent changes expected)
- ✅ Clear versioning path

**Potential future modules:**

- `acute_care_stroke` - Stroke acute care workflow
- `primary_care_shoulder` - Primary care shoulder assessment
- `sports_pt_throwing` - Throwing athlete return-to-throw
- `icu_weaning` - ICU mobility and ventilator weaning
- `pediatric_motor_delay` - Pediatric developmental assessment

---

## Migration Strategy

### Phase 1: Setup Shared Library (Low Risk)

1. Create `src/sps/content/banks/modules/` directory
2. Copy 3 modules to shared library with v1 naming
3. Create module registry (`index.json`)
4. Add README documentation

**Risk:** None - no existing code changes

### Phase 2: Dual-Path Support (Medium Risk)

1. Add module resolver function to session.ts
2. Support both old (file path) and new (module ID) references
3. Update scenario loader to check reference type
4. Add validation for module references

**Risk:** Moderate - requires careful path resolution logic

### Phase 3: Migrate Scenarios (Low-Medium Risk)

1. Update `sc_hip_tha_anterior_pod0_v1` header to use module ID
2. Update `sc_lumbar_clbp_ext_pref_flare_v1` header to use module ID
3. Update `sc_knee_acl_preop_direct_access_v1` header to use module ID
4. Test each scenario individually

**Risk:** Low - JSON edits only, easily reversible

### Phase 4: Remove Old Files (Low Risk)

1. Delete `*.module.json` from scenario bundle directories
2. Remove old file-path resolution code
3. Update validator to check module references only

**Risk:** Low - code cleanup only

---

## Testing Requirements

### Unit Tests

- [ ] Module registry loading
- [ ] Module resolution by ID + version
- [ ] Checksum verification
- [ ] Missing module error handling
- [ ] Invalid version error handling

### Integration Tests

- [ ] Scenario loading with module references
- [ ] Module data merging into scenario context
- [ ] Multiple modules per scenario
- [ ] Version pinning (v1 vs latest)

### Validation Tests

- [ ] Module registry schema validation
- [ ] Module file checksum verification
- [ ] Scenario module reference validation
- [ ] Missing module detection

---

## Success Metrics

| Metric | Target | Rationale |
|--------|--------|-----------|
| Module reusability | 3/3 modules in shared library | Enable cross-scenario module sharing |
| Code duplication | 0 duplicate *.module.json files | Single source of truth |
| Version control | 100% modules versioned | Enable safe upgrades |
| Checksum verification | 100% modules verified | Detect corruption/tampering |
| Test coverage | 100% module resolution logic | Ensure reliability |
| Validation errors | 0 errors post-migration | Maintain data integrity |

---

## Recommendations

### Immediate Actions (Phase 4 Task 2)

1. ✅ Create shared module library directory structure
2. ✅ Move 3 modules to shared library with v1 versioning
3. ✅ Build module registry with checksums and metadata
4. ✅ Implement module resolver in session.ts
5. ✅ Update 3 scenario headers to use module references
6. ✅ Test and validate changes

### Future Enhancements (Phase 4 Task 3+)

1. **Module versioning CLI tool** - Automate module version bumps with changelog
2. **Module dependency graph** - Track which scenarios use which modules
3. **Module schema validation** - Enforce structure for each module type
4. **Module hot-reloading** - Update modules without restarting server (dev mode)
5. **Module analytics** - Track module usage patterns and identify candidates for consolidation

---

## Files to Modify

### New Files

- `src/sps/content/banks/modules/README.md`
- `src/sps/content/banks/modules/index.json`
- `src/sps/content/banks/modules/acute_care_total_joint.v1.json`
- `src/sps/content/banks/modules/primary_care_low_back_pain.v1.json`
- `src/sps/content/banks/modules/sports_pt_generic.v1.json`

### Modified Files

- `src/sps/runtime/session.ts` - Add module resolver function
- `src/sps/content/scenarios/bundles_src/sc_hip_tha_anterior_pod0_v1/scenario.header.json`
- `src/sps/content/scenarios/bundles_src/sc_lumbar_clbp_ext_pref_flare_v1/scenario.header.json`
- `src/sps/content/scenarios/bundles_src/sc_knee_acl_preop_direct_access_v1/scenario.header.json`
- `src/sps/tools/validate-data.ts` - Add module reference validation

### Deleted Files (after migration complete)

- `src/sps/content/scenarios/bundles_src/sc_hip_tha_anterior_pod0_v1/acute_care.module.json`
- `src/sps/content/scenarios/bundles_src/sc_lumbar_clbp_ext_pref_flare_v1/primary_spine.module.json`
- `src/sps/content/scenarios/bundles_src/sc_knee_acl_preop_direct_access_v1/sports.module.json`

---

## Conclusion

Module library extraction is feasible with **low risk**. All 3 modules are good candidates for shared library. Implementation can proceed with confidence using phased migration approach (dual-path support → scenario migration → cleanup).

**Estimated Time:** 2-3 hours  
**Risk Level:** Low  
**Reversibility:** High (Git revert)  
**Test Coverage Required:** Medium (module resolution + scenario loading)

Ready to proceed with implementation.
