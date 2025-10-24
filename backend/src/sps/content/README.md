# SPS Runtime Content

This directory contains production runtime content only.
No authoring templates or source bundles in production builds.

## Structure

- `personas/` - Patient personas (realtime, shared, base)
- `scenarios/compiled/` - Compiled scenario artifacts (production)
- `scenarios/bundles_src/` - Source bundles (development only, excluded from Docker)
- `banks/` - Clinical content libraries (challenges, questions, catalogs)

## Usage

**Production:** Only `personas/`, `scenarios/compiled/`, and `banks/` are deployed.
**Development:** Full structure available for compilation and testing.

See: ops/docs/SPS_CONTENT_REFACTOR_PLAN.md
