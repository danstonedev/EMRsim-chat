# SPS Content Authoring Guide

This guide explains the SPS content system's structure, authoring workflow, and tooling after the Oct 2025 refactor.

> **💡 AI-Assisted Case Generation:** For generating new clinical scenarios using AI, see [LLM_CASE_GENERATION_PROMPT_KIT.md](LLM_CASE_GENERATION_PROMPT_KIT.md) which provides plug-and-play prompts for LLMs to create entry-level DPT cases.

## Content Structure

``` text
backend/src/sps/
  content/                 # Runtime-ingested only
    personas/
      realtime/*.json      # Canonical personas
      shared/*.json        # Former scenario personas (already canonical)
    scenarios/
      compiled/*.json      # Single-file compiled scenarios
    banks/
      challenges.json
      special_questions/*.json
      catalogs/**          # ONLY authoritative catalogs
      modules/**           # Shared module definitions
  authoring/
    bundles_src/<scenario_id>/*  # Segmented scenario source files
    templates/**                # Scaffolding blueprints only
```

## Authoring Workflow

### 1. Creating/Modifying Scenarios

Scenarios are authored as bundle files in `authoring/bundles_src/<scenario_id>/`:

- `<scenario_id>.header.json` - Metadata, title, and module references
- `<scenario_id>.context.json` - Contextual settings and catalog references
- `<scenario_id>.content.json` - Scenario-specific content
- `<scenario_id>.module.<module_id>.json` - Module-specific configuration

After making changes, compile the scenario:

```bash
npm run sps:compile --scenario=<scenario_id>
```

This generates a single compiled file in `content/scenarios/compiled/<scenario_id>.json`.

### 2. Creating/Modifying Personas

Personas are stored in:

- `content/personas/realtime/*.json` - For realtime personas
- `content/personas/shared/*.json` - For shared personas used across scenarios

When updating a persona, ensure it includes the metadata fields:

```json
{
  "patient_id": "unique_id",
  "content_version": "1.0.0",
  "updated_at": "2025-10-08T12:00:00Z",
  "change_notes": ["Initial version"]
}
```

### 3. Managing Modules

Shared modules are stored in `content/banks/modules/<module_id>.v<version>.json`.

When creating a new module version, increment the version number in the filename.

### 4. Content Versioning

Every content asset includes version metadata:

- `content_version` - Semantic version (MAJOR.MINOR.PATCH)
- `updated_at` - ISO timestamp of last update
- `change_notes` - Array of notes documenting changes

To bump a version:

```bash
# Bump persona version
npm run sps:bump-version -- --type=persona --id=<persona_id> --bump=minor --note="Added health conditions"

# Bump scenario version
npm run sps:bump-version -- --type=scenario --id=<scenario_id> --bump=patch --note="Fixed typos"

# Bump module version
npm run sps:bump-version -- --type=module --id=<module_id> --bump=major --note="Breaking change to module API"

# Other options
npm run sps:bump-version -- --help
```

The tool will:

1. Update the version number according to semantic versioning rules
2. Add your change note to the version history
3. Regenerate the content manifests
4. For scenarios, trigger recompilation of the affected scenario

When to bump versions:

- **Major (1.0.0)**: Breaking changes that require updates to dependent content
- **Minor (0.1.0)**: New features or significant content additions
- **Patch (0.0.1)**: Bug fixes, typo corrections, minor content adjustments

### 5. Generating Manifests

After making changes, regenerate the content manifests:

```bash
npm run sps:generate-manifests
```

This creates:

- `content/manifest.json` - Version information for all content
- `content/dependencies.json` - Scenario dependency relationships
- `content/catalogs/report.json` - Catalog usage analysis

### 6. Validating Changes

Ensure your changes are valid:

```bash
npm run sps:validate-compiled
```

## Deployment Workflow

1. Author changes to content assets
2. Generate manifests (`npm run sps:generate-manifests`)
3. Compile scenarios (`npm run sps:compile`)
4. Validate changes (`npm run sps:validate-compiled`)
5. Commit changes to git
6. Deploy container (CI pipeline excludes authoring assets)

## Runtime Behavior

The SPS system loads compiled scenarios and other content assets at startup. A feature flag controls whether to use compiled scenarios or dynamic loading:

- `SPS_USE_DYNAMIC_LOAD=1` - Load scenario bundles directly (slower, development only)
- Default - Use compiled scenarios (faster, production default)

## Troubleshooting

### Compilation Errors

If compilation fails:

1. Check console output for specific errors
2. Ensure all referenced modules exist
3. Verify persona references are valid
4. Check JSON syntax in bundle files

### Version Conflicts

If validation shows version conflicts:

1. Regenerate manifests (`npm run sps:generate-manifests`)
2. Recompile scenarios (`npm run sps:compile`)
3. Check dependency relationships in `content/dependencies.json`

### Runtime Errors

If content fails to load at runtime:

1. Set `SPS_USE_DYNAMIC_LOAD=1` to bypass compilation
2. Check logs for specific loading errors
3. Verify all referenced content exists
