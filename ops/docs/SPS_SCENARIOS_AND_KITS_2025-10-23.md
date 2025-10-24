# SPS scenarios and kits update (2025-10-23)

This note summarizes the entry-level SPS scenarios and kits added today, and how to compile, validate, and deploy.

## What's new

- Scenarios (bundles in `backend/src/sps/content/scenarios/bundles_src/`):
  - `sc_knee_pfp_entry_v1` – Entry: Patellofemoral Pain with Stair Descent – Runner
  - `sc_knee_tcoa_entry_v1` – Entry: Tricompartmental Knee OA — Mobility and Function Limits
  - `sc_knee_mcl_grade1_entry_v1` – Entry: MCL Sprain — Grade I
- Kits (content-first path for serverless packaging in `backend/src/sps/content/kits/`):
  - New: `knee_oa_tricompartmental_v1`, `mcl_grade1_sprain_v1`
  - Mirrored: `patellofemoral_pain_v1`, `patellar_tendinosis_v1`
- Scenario → Kit mapping (`backend/src/sps/config/kit-mapping.json`):
  - `sc_knee_pfp_entry_v1` → `patellofemoral_pain_v1`
  - `sc_knee_tcoa_entry_v1` → `knee_oa_tricompartmental_v1`
  - `sc_knee_mcl_grade1_entry_v1` → `mcl_grade1_sprain_v1`

## Compile and validate locally

- Compile/manifest pipeline and validators are wired to repo tasks. Use these tasks in VS Code:
  - Backend: Test & Validate (runs tests + SPS validators)
  - Backend: Type Check & Build (verify)
- Expected outcomes: validators PASS; type-check/build PASS; compiled scenarios in `backend/src/sps/content/scenarios/compiled/`.

## Packaging for Vercel

- Serverless includeFiles (`backend/vercel.json`) points to `dist/sps/content/**`.
- The build script copies `src/sps/content` to `dist/sps/content`, so bundles and kits are included at runtime.
- Kit loader prefers `content/kits/<case_id>/kit.json` (then falls back to `kits/<case_id>/kit.json`).

## Deployment

- Deploy via the included script: `scripts/deploy-vercel.ps1` (backend then frontend).
- Ensure frontend `VITE_API_BASE_URL` points to the latest backend URL in Vercel env vars.
- After deploy, quick checks:
  - GET `/health` → ok
  - GET `/api/sps/scenarios` → includes the three scenarios above
  - Frontend dropdown auto-populates from the catalog API

## Notes

- Suggested personas are defined per scenario in `kit-mapping.json` and used for UI suggestions.
- Any future scenarios should follow the same 6-file bundle structure and be compiled before deploy.
