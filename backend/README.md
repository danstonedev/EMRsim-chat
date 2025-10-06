# Backend (Node tiny proxy)

## Quickstart

```powershell
cd backend
npm i
copy .env.example .env
npm run dev
```

- Serves on `http://localhost:3001`
- Health: `GET /api/health`
- Voice token minting: `POST /api/voice/token` (requires `VOICE_ENABLED=true`, `OPENAI_API_KEY`)

## Env

- `OPENAI_API_KEY` (optional for v0.1; mock used if absent)
- `OPENAI_REALTIME_MODEL` (default `gpt-realtime-2025-08-28`)
- `OPENAI_TEXT_MODEL` (default `gpt-4o-mini`)
- `OPENAI_TTS_VOICE` (defaults to `alloy`; unsupported values automatically fall back to `alloy`)
- `OPENAI_TRANSCRIPTION_MODEL` (default `gpt-4o-mini-transcribe` for low-latency streaming)
- `REALTIME_VAD_THRESHOLD`, `REALTIME_VAD_PREFIX_MS`, `REALTIME_VAD_SILENCE_MS` (override server VAD; defaults tuned for fast turn detection)
- `DATABASE_URL` (SQLite), default `file:./dev.db`
- Feature flags: `VOICE_ENABLED=false`, `BANNERS_ENABLED=true`, `NEGOTIATOR_ENABLED=false`, `GRADING_ENABLED=false`

## Voice notes

- Set `VOICE_ENABLED=true` and `OPENAI_API_KEY` to unlock the `/api/voice/token` route.
- The client must create a voice session via `POST /api/sessions` (`mode:"voice"`) before requesting a token.
- The token endpoint now verifies the session/persona and forwards persona directives to the OpenAI Realtime session.
- Supported voices match OpenAI's realtime API: `alloy`, `ash`, `ballad`, `coral`, `echo`, `sage`, `shimmer`, `verse`, `marin`, `cedar`. Configure `OPENAI_TTS_VOICE` with one of these values (case-insensitive); any other value gracefully falls back to `alloy` and logs the upstream response if the provider rejects the request.

## Testing

We use `vitest` for unit + structural SPS tests. All test files live under `backend/tests/`.

Run the suite:

```powershell
cd backend
npm test
```

Key SPS test files:

| File | Purpose |
|------|---------|
| `tests/schemas.test.ts` | Validates Zod schemas & registry loading. |
| `tests/matcher.test.ts` | Ensures challenge / special question matching logic works. |
| `tests/conversation_structural.test.ts` | Traverses every persona × scenario through subjective/objective/treatment phases to catch structural regressions. |
| `tests/conversation_stress.test.ts` | Applies repeated pressure to a locked gate to verify escalation & no leakage of gated info. |
| `tests/persona_tone_randomness.test.ts` | Asserts persona tone prefix consistency, gate nudge sequencing, variant bounds, persona immutability. |
| `tests/randomness_distribution.test.ts` | Samples randomized gate nudges to ensure both variants surface and escalation reliability. |
| `tests/routes.test.ts` | API integration path: compose, turn, phase transitions, escalation. |

### Adding new SPS tests

1. Place the file in `backend/tests/` with a `.test.ts` suffix.
2. If you need to load personas/scenarios, call `loadSPSContent()` once per file (top-level or in a `beforeAll`).
3. For conversation driving, prefer using existing helpers in structural tests as a template.
4. Keep tests deterministic unless explicitly measuring randomness; when sampling randomness, assert on set membership / coverage, not exact strings.

### Troubleshooting

- If a new test is not discovered, confirm the glob in `vitest.config.mjs` is still `tests/**/*.test.ts`.
- Guardrail warnings like `Persona age < scenario min_age` surface from `registry`—they do not fail tests but highlight content alignment issues.
- To inspect a failing structural traversal, temporarily log inside the failure catch collecting persona & scenario ids.

### Extending randomness coverage

If additional cue variants are introduced (e.g., multiple detail fragments), replicate the pattern in `randomness_distribution.test.ts` to assert each variant appears at least once over N samples (choose N roughly 10× the variant count).


## Scripts

- `dev`: Start the backend API with hot reload.
- `test`: Run unit tests with Vitest.
- `sps:validate`: Validate SPS JSON banks and cross-references.

### Optional: pre-commit validation (Husky)

This repo includes a Husky pre-commit hook that runs the SPS validator when SPS data or related backend files are staged. To enable it locally:

1. Initialize Husky (one-time, at repo root):

   - npm: `npx husky init`
   - pnpm: `pnpm dlx husky init`

2. Commit as usual. When changes touch `backend/src/sps/**` or `backend/package*.json`, the hook will run `npm run sps:validate` and block the commit on errors.

If you prefer not to use local hooks, rely on the CI workflow which validates on pull requests.

