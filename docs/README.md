# Project documentation index

Use this page as the single entry point to all docs. It groups existing Markdown by topic and links to the original files (we aren’t moving files to avoid breaking history/links).

## Architecture

- Current: [docs/current-architecture.md](./current-architecture.md)
- Proposed: [docs/proposed-architecture.md](./proposed-architecture.md)
- Migration plan: [docs/migration-plan.md](./migration-plan.md)

## Setup and local development

- Root overview and quick start: [README.md](../README.md)
- Build guide: [ops/docs/BUILD_GUIDE.md](../ops/docs/BUILD_GUIDE.md)
- Docker setup: [DOCKER.md](../DOCKER.md)

## Frontend — 3D viewer, animations, media

- Mixamo and assets
  - [TEAM_QUICK_START_MIXAMO.md](../TEAM_QUICK_START_MIXAMO.md)
  - [MIXAMO_INTEGRATION_COMPLETE.md](../MIXAMO_INTEGRATION_COMPLETE.md)
  - [frontend/docs/MIXAMO_ASSET_GUIDE.md](../frontend/docs/MIXAMO_ASSET_GUIDE.md)
- Viewer and animation guides/fixes
  - [3D_VIEWER_START_HERE.md](../3D_VIEWER_START_HERE.md)
  - [3D_VIEWER_IMPLEMENTATION.md](../3D_VIEWER_IMPLEMENTATION.md)
  - [3D_VIEWER_MODERNIZATION_COMPLETE.md](../3D_VIEWER_MODERNIZATION_COMPLETE.md)
  - [3D_VIEWER_FIXED.md](../3D_VIEWER_FIXED.md)
  - [3D_VIEWER_FEATURE_CLEANUP.md](../3D_VIEWER_FEATURE_CLEANUP.md)
  - [3D_VIEWER_BUG_FIX.md](../3D_VIEWER_BUG_FIX.md)
  - [3D_VIEWER_DEBUG_SESSION.md](../3D_VIEWER_DEBUG_SESSION.md)
  - [3D_VIEWER_ROADMAP.md](../3D_VIEWER_ROADMAP.md)
  - [ALL_ANIMATIONS_INTEGRATED.md](../ALL_ANIMATIONS_INTEGRATED.md)
  - [ANIMATION_NAMING_FIX.md](../ANIMATION_NAMING_FIX.md)
  - [ANIMATION_PLAYBACK_FIX.md](../ANIMATION_PLAYBACK_FIX.md)
  - [ANIMATION_SELECTOR_FIX.md](../ANIMATION_SELECTOR_FIX.md)
  - [ANIMATION_CONTROL_FIX.md](../ANIMATION_CONTROL_FIX.md)
  - [ANIMATION_DEBUG_SESSION.md](../ANIMATION_DEBUG_SESSION.md)
  - [ANIMATION_DEBUG_REPORT.md](../ANIMATION_DEBUG_REPORT.md)
  - [frontend/docs/ANIMATION_BINDING_AND_TESTING.md](../frontend/docs/ANIMATION_BINDING_AND_TESTING.md)
  - [3D_ANIMATION_DEVELOPMENT_GUIDE.md](../3D_ANIMATION_DEVELOPMENT_GUIDE.md)
  - [3D_ANIMATION_MODAL_FIX.md](../3D_ANIMATION_MODAL_FIX.md)
  - [MIXAMO_ANIMATIONS_ADDED.md](../MIXAMO_ANIMATIONS_ADDED.md)
  - [TEXT_TO_ANIMATION_COMPLETE.md](../TEXT_TO_ANIMATION_COMPLETE.md)
- 3D model integration
  - [3D_MODEL_INTEGRATION_FRAMEWORK.md](../3D_MODEL_INTEGRATION_FRAMEWORK.md)
  - [3D_MODEL_UPDATE.md](../3D_MODEL_UPDATE.md)
  - [3D_RENDERING_MODULARIZATION_COMPLETE.md](../3D_RENDERING_MODULARIZATION_COMPLETE.md)
- Media
  - [AUDIO_AND_MEDIA_FIX.md](../AUDIO_AND_MEDIA_FIX.md)
  - [YOUTUBE_EMBED_GUIDE.md](../YOUTUBE_EMBED_GUIDE.md)

## Conversation and voice

- Conversation controller
  - [frontend/docs/conversation-controller-map.md](../frontend/docs/conversation-controller-map.md)
  - [frontend/docs/conversation-controller-refactor-continuation.md](../frontend/docs/conversation-controller-refactor-continuation.md)
- Voice metrics and status
  - [VOICE_STATUS_FIX.md](../VOICE_STATUS_FIX.md)
  - [ops/docs/VOICE_METRICS_SLA_PLAN.md](../ops/docs/VOICE_METRICS_SLA_PLAN.md)

## Backend and API

- API contracts: [ops/docs/API_CONTRACTS.md](../ops/docs/API_CONTRACTS.md)
- Data model: [ops/docs/DATA_MODEL.md](../ops/docs/DATA_MODEL.md)
- Transport and transcripts
  - [ops/docs/TRANSPORT_PATH_SURVEY.md](../ops/docs/TRANSPORT_PATH_SURVEY.md)
  - [ops/docs/TRANSCRIPT_RELAY_DEDUPE_SPEC.md](../ops/docs/TRANSCRIPT_RELAY_DEDUPE_SPEC.md)

## Testing and quality

- [TESTING_GUIDE.md](../TESTING_GUIDE.md)
- [TESTING_CHECKLIST.md](../TESTING_CHECKLIST.md)
- [ops/docs/TEST_PLAN.md](../ops/docs/TEST_PLAN.md)

## Production and operations

- [PRODUCTION_READINESS.md](../PRODUCTION_READINESS.md)
- [PRODUCTION_IMPROVEMENTS_COMPLETE.md](../PRODUCTION_IMPROVEMENTS_COMPLETE.md)
- Ops docs landing: [ops/docs/README.md](../ops/docs/README.md)

## Refactoring and cleanup (history and plans)

- Cleanup and refactor phases
  - [PHASE1_CLEANUP_COMPLETE.md](../PHASE1_CLEANUP_COMPLETE.md)
  - [PHASE2_DEPRECATION_CLEANUP_COMPLETE.md](../PHASE2_DEPRECATION_CLEANUP_COMPLETE.md)
  - [PHASE3_REFACTOR_PLAN.md](../PHASE3_REFACTOR_PLAN.md)
  - [PHASE3_COMPLETE.md](../frontend/PHASE3_COMPLETE.md)
  - [PHASE3_SUMMARY.md](../frontend/PHASE3_SUMMARY.md)
  - [PHASE3.4_COMPLETE.md](../frontend/PHASE3.4_COMPLETE.md)
  - [REFACTOR_PHASE5_COMPLETE.md](../REFACTOR_PHASE5_COMPLETE.md)
- Summaries and analyses
  - [REFACTORING_IMPLEMENTATION_GUIDE.md](../frontend/REFACTORING_IMPLEMENTATION_GUIDE.md)
  - [REFACTORING_SUMMARY.md](../frontend/REFACTORING_SUMMARY.md)
  - [CLEANUP_SUMMARY.md](../CLEANUP_SUMMARY.md)
  - [CODE_MODERNIZATION_ANALYSIS.md](../CODE_MODERNIZATION_ANALYSIS.md)
  - [CONSOLE_WARNINGS_FIX.md](../CONSOLE_WARNINGS_FIX.md)
  - [PLAY_PAUSE_FIX.md](../PLAY_PAUSE_FIX.md)

## Changelog and results

- Changelog: [CHANGELOG.md](../CHANGELOG.md)
- Results snapshots: [RESULTS.md](../RESULTS.md)

## Contributing docs (light guidance)

- Keep new architecture or cross-cutting docs under `docs/`.
- Frontend-only deep dives go in `frontend/docs/`.
- Ops/process/API docs live in `ops/docs/`.
- For one-off fixes or historical notes at repo root, add a short “Context” line at the top and link the file in a relevant section above.
