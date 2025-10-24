# SPS Module Library

**Path:** `src/sps/content/banks/modules/`  
**Purpose:** Shared clinical context modules for scenario composition

---

## Overview

The module library provides reusable clinical context data that can be referenced by multiple scenarios. Modules encapsulate specialized domain knowledge (acute care workflows, assessment protocols, return-to-sport criteria) in a versioned, checksummed format.

---

## Module Structure

### Module File Format

Each module is a JSON file with the following structure:

```json
{
  "module_id": "unique_module_identifier",
  // ... domain-specific fields ...
}
```

### Module Naming Convention

Files are named: `<module_id>.v<version>.json`

Examples:

- `acute_care_total_joint.v1.json`
- `primary_care_low_back_pain.v1.json`
- `sports_pt_generic.v1.json`

---

## Module Registry

The `index.json` file serves as the module registry, providing:

- Module metadata (description, clinical domains)
- Version information (latest version, all available versions)
- Checksums for integrity verification
- Creation/update timestamps

### Registry Schema

```json
{
  "schema_version": "1.0.0",
  "generated_at": "2025-10-06T17:00:00Z",
  "modules": {
    "<module_id>": {
      "versions": {
        "<version>": {
          "file": "<filename>.json",
          "checksum": "sha256:<hash>",
          "description": "Module description",
          "clinical_domains": ["domain1", "domain2"],
          "created_at": "ISO 8601 timestamp",
          "status": "stable|beta|deprecated"
        }
      },
      "latest": "<version>"
    }
  }
}
```

---

## Usage in Scenarios

### Referencing Modules

Scenarios reference modules by ID and version in their `scenario.header.json`:

```json
{
  "linkage": {
    "active_context_modules": [
      {
        "module_id": "acute_care_total_joint",
        "version": "v1"
      }
    ]
  }
}
```

### Module Resolution

The scenario loader resolves module references by:

1. Reading `index.json` to find module file path
2. Loading the module file from `banks/modules/`
3. Verifying checksum against registry
4. Merging module data into scenario context

---

## Available Modules

### 1. Acute Care Total Joint (`acute_care_total_joint`)

**Latest Version:** v1  
**Clinical Domains:** Acute care, post-surgical rehabilitation, discharge planning  
**Use Cases:** Post-operative THA/TKA scenarios (POD0-POD3)

**Key Data:**

- Post-op day, procedure type, surgical approach
- Weight-bearing status, joint precautions
- Lines/tubes/drains inventory
- Mobility orders, pain management protocols
- DVT/PE prophylaxis details
- Discharge milestones and planning

---

### 2. Primary Care Low Back Pain (`primary_care_low_back_pain`)

**Latest Version:** v1  
**Clinical Domains:** Primary care musculoskeletal, pain science, imaging guidelines  
**Use Cases:** Outpatient low back pain evaluation and management

**Key Data:**

- LBP classification (specific vs nonspecific)
- Psychosocial screening scores (STarT Back, FABQ, PCS)
- Directional preference and centralization
- Neurological examination findings
- Red flag screening
- Imaging appropriateness criteria
- Education intervention seeds

---

### 3. Sports PT Generic (`sports_pt_generic`)

**Latest Version:** v1  
**Clinical Domains:** Sports physical therapy, return-to-play, load management  
**Use Cases:** Return-to-sport assessment and clearance

**Key Data:**

- Sport type, position, competition level
- Season phase (in-season, off-season, pre-season)
- Workload metrics (acute/chronic load ratios)
- Criterion-based testing batteries
- Readiness indicators (ACL-RSI, psychological readiness)
- Clearance checklist framework

---

## Versioning

### Version Format

Versions use semantic versioning: `v<major>.<minor>.<patch>` (simplified to `v<major>` for now)

- **v1**: Initial stable version
- **v2**: Breaking changes (field renames, schema changes)
- **v1.1**: Minor additions (new optional fields)
- **v1.0.1**: Bug fixes (typo corrections, no schema change)

### Upgrade Path

Scenarios pin to specific versions for stability. When modules are updated:

1. New version created (e.g., v2)
2. Old version remains available (v1)
3. Scenarios can upgrade at their own pace
4. Deprecated versions marked in registry

---

## Adding New Modules

### Step 1: Create Module File

Create `<module_id>.v1.json` with your module data:

```json
{
  "module_id": "your_module_id",
  // ... your domain-specific fields ...
}
```

### Step 2: Calculate Checksum

```powershell
Get-FileHash -Path "your_module_id.v1.json" -Algorithm SHA256
```

### Step 3: Update Registry

Add entry to `index.json`:

```json
{
  "your_module_id": {
    "versions": {
      "v1": {
        "file": "your_module_id.v1.json",
        "checksum": "sha256:<hash>",
        "description": "Brief description",
        "clinical_domains": ["domain1"],
        "created_at": "2025-10-06T00:00:00Z",
        "status": "stable"
      }
    },
    "latest": "v1"
  }
}
```

### Step 4: Reference in Scenario

Update scenario header to reference your module:

```json
{
  "linkage": {
    "active_context_modules": [
      {
        "module_id": "your_module_id",
        "version": "v1"
      }
    ]
  }
}
```

---

## Module Types (Future)

Potential future module categories:

- **Acute Care:** ICU weaning, stroke acute care, cardiac rehab
- **Primary Care:** Shoulder evaluation, knee OA, headache
- **Sports PT:** Throwing athletes, running analysis, concussion RTP
- **Pediatrics:** Motor delay, torticollis, gait analysis
- **Neuro:** CVA assessment, TBI protocols, vestibular screening
- **Geriatrics:** Fall risk assessment, frailty screening, balance protocols

---

## Validation

Modules are validated for:

- ✅ Valid JSON syntax
- ✅ Required `module_id` field
- ✅ Checksum matches registry
- ✅ Referenced by at least one scenario (or marked experimental)

Run validation:
```bash
npm run sps:validate
```

---

## Maintenance

### Regular Tasks

- Review module usage (identify unused modules)
- Update checksums after module edits
- Deprecate old versions after migration complete
- Document breaking changes in changelog

### Deprecation Process

1. Mark version as `deprecated` in registry
2. Add deprecation notice with migration guide
3. Update all scenarios to use new version
4. Remove deprecated version after grace period (e.g., 3 months)

---

## Questions?

For questions about module library design, see:

- `ops/docs/PHASE4_TASK2_ANALYSIS.md` - Detailed analysis
- `ops/docs/PHASE4_IMPLEMENTATION.md` - Implementation plan
- `ops/docs/SPS_CONTENT_REFACTOR_PLAN.md` - Overall refactor strategy
