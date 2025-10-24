# SPS Kits, Audience Separation, and Grounded Instruction Guide

Last Updated: October 23, 2025

This guide explains how our scenario kits power grounded, role-aware instructions for the voice chatbot, how student vs faculty separation works end-to-end, and how to author, validate, and map kits to scenarios.

---

## What this enables

- Grounded responses backed by vetted facts from “kits” (per-case knowledge bundles)
- Audience separation: student users never see faculty-only “ground truth”
- Role directives (e.g., clinician, translator) compose with persona/scenario guidance
- Editorial control via JSON mapping of scenario_id → case kit
- Validation tooling to protect content quality

---

## High-level flow

1) Frontend lets a user choose their audience: Student or Faculty (two buttons under the Case Setup modal).
2) Frontend requests instructions from the backend, always passing the current `audience`.
3) Backend composes instructions from layers: baseline → persona → scenario → role → retrieved facts from kits → media guidance → phase/gates.
4) Kits retriever selects audience-appropriate chunks and injects them into the composed instructions. The response also returns `retrieved_ids` for traceability.

---

## Role-agnostic baseline and patient role directive (updated)

- The baseline instructions are now role-agnostic and focus on interaction fundamentals: precedence, truthfulness, consistency, safety, variation guardrails, and structured-data priority.
- Patient-specific behaviors (identity verification flow, exam boundaries, refusal patterns, teach-back rules, length by question type, challenge behaviors, etc.) have moved into the Patient role directive.
- Result: clear separation of concerns and safer composition when adding non-patient roles (translator, family, clinician, scribe). The composer layers baseline → persona → scenario → role → retrieved facts.

---

## Authoring kits

Kits live under `backend/src/sps/kits/<case_id>/kit.json` and contain an array of chunks with metadata. Here’s a minimal example with the enhanced schema:

```json
{
  "case_id": "patellofemoral_pain_v1",
  "chunks": [
    {
      "id": "cpg_summary",
      "text": "2019 PFP CPG highlights...",
      "audiences": ["student", "faculty"],
      "roles": ["clinician"],
      "phases": ["history", "exam"],
      "weight": 1.0,
      "media_ids": ["pfp_video_intro"],
      "title": "PFP CPG Summary",
      "chunk_type": "reference",
      "source": "2019 PFP Clinical Practice Guideline",
      "citations": ["doi:10.2519/jospt.2019.0302"],
      "links": ["https://www.jospt.org/doi/full/10.2519/jospt.2019.0302"]
    },
    {
      "id": "faculty_ground_truth",
      "text": "Diagnosis is likely PFP based on ...",
      "audiences": ["faculty"],
      "roles": ["clinician"],
      "phases": ["assessment"],
      "weight": 2.0,
      "chunk_type": "ground_truth"
    }
  ]
}
```

Key fields (per chunk):

- id: unique within the kit
- text: the content to inject/ground on
- audiences: ["student" | "faculty"] — controls visibility
- roles: optional role targeting (e.g., clinician, translator)
- phases: optional gates/phases within the interaction
- weight: optional selection bias for the retriever
- media_ids: optional list of media references
- title, chunk_type, source, citations, links: optional metadata to help authors and traceability

Validator rule: Any chunk that represents “ground truth” for the case should be marked faculty-only. The validator emits a warning if a ground truth chunk is not audience-restricted.

---

## Validation: keep kits clean

Use the validator to catch schema errors, duplicate chunk IDs, and audience discipline for ground truth.

PowerShell (Windows):

```powershell
# Run the SPS kits validator
cd backend
npm run sps:validate
```

What it checks:

- Zod schema validity for the kit file
- Duplicate chunk IDs in a kit
- `case_id` coherence
- Warning: “ground truth” content should be `audiences: ["faculty"]`
- Scenario mapping checks (via `sps:mapping:validate`):
  - Suggested personas exist in the registry
  - Age and sex guardrails (min_age, max_age, sex_required)
  - Pregnancy incompatibility: a male persona may not be marked pregnant/postpartum
  - If a scenario sets `guardrails.strict: true`, guardrail violations are treated as errors

---

## Mapping scenarios to kits (editorial control)

Scenario-to-kit mapping is a simple JSON file:

- Path: `backend/src/sps/config/kit-mapping.json`
- Example:

```json
{
  "sc_knee_anterior_knee_pain_entry_v1": "patellofemoral_pain_v1"
}
```

Runtime behavior:

- Loader reads and caches this mapping for performance
- If a scenario isn’t mapped, the system falls back to a safe default

To add a new case:

1) Create the kit at `backend/src/sps/kits/<your_case_id>/kit.json`
2) Add an entry to `backend/src/sps/config/kit-mapping.json`
3) Run the validator (see above)

### Suggested personas (optional)

You can also recommend a set of plausible personas for each scenario. The frontend will auto-select a random one when a scenario is chosen and no persona has been picked yet (users can override).

Extended mapping format:

```json
{
  "sc_knee_anterior_knee_pain_entry_v1": {
    "case_id": "patellofemoral_pain_v1",
    "personas": [
      "p_runner_22_f",
      { "id": "p_teacher_38_f", "weight": 2 }
    ]
  }
}
```

Notes:

- `personas` accepts strings or objects with `{ id, weight }` for weighted randomization.
- The scenarios list API now includes `suggested_personas` so the UI can auto-select a recommended patient.
- A mapping validator checks that suggested personas exist and match basic scenario guardrails (min/max age, required sex).

Validate suggested personas:

```powershell
cd backend
npm run sps:mapping:validate

# Or validate both kits and mapping
npm run sps:validate:content
```

---

## New demo case: Patellar Tendinosis (Jumper's Knee)

- Scenario ID: `sc_knee_anterior_knee_pain_tendinosis_v1`
- Kit ID: `patellar_tendinosis_v1`
- Mapping: declared in `backend/src/sps/config/kit-mapping.json` with suggested personas favoring young athletes
- Guardrails: `{ min_age: 15, max_age: 40, strict: true }` — validator treats age/sex mismatches as errors for this scenario

Authoring notes:

- Student-facing chunks describe load-related pain and decline squat provocation.
- Faculty-only ground truth chunk states the working diagnosis is patellar tendinopathy.

---

## Audience selection UI (frontend)

- Location: under the Case Setup modal (also visible when the modal is closed)
- Behavior: two buttons — “Student” and “Faculty”; the active one shows a green outline with a subtle selection animation
- Key files:
  - `frontend/src/pages/components/chat/CaseSetupBar.tsx`
  - `frontend/src/styles/chat/case-setup.css`

The selection is stored in page state and sent with every instruction refresh.

---

## API contract changes

Endpoint: `POST /voice/instructions`

Request body (relevant fields):

```json
{
  "scenario_id": "...",
  "role_id": "clinician",
  "audience": "student" // or "faculty"
}
```

Response (excerpt):

```json
{
  "instructions": "...composed text with grounded facts...",
  "phase": "history",
  "outstanding_gate": null,
  "retrieved_ids": ["cpg_summary", "..." ]
}
```

Notes:

- `audience` is threaded throughout the backend composer and retriever
- `retrieved_ids` provide traceability of which kit chunks were used

---

## Implementation notes for developers

Backend

- Kits runtime: `backend/src/sps/runtime/kits.ts`
  - Loads `kit-mapping.json`, caches it, and provides a safe fallback
  - Audience-aware filtering and formatting of retrieved facts
- Kit schema: `backend/src/sps/schemas/kit.ts`
  - Zod schema includes metadata fields: `title`, `chunk_type`, `source`, `citations`, `links`
- Kits validator: `backend/src/sps/runtime/validation/kitsValidationService.ts`
  - Adds a warning if “ground truth” chunks are not faculty-only

Frontend

- Audience state lives in `ChatPage.tsx` and is passed through `ChatView` → `CaseSetupBar`
- Instruction refresh always merges the current audience:
  - `frontend/src/features/voice/conversation/instructions/instructionSync.ts`
  - API client: `frontend/src/shared/api.ts` (accepts `audience`)

---

## Author checklist (new case)

1) Draft kit chunks with clear IDs and audience tags; mark ground truth as `faculty`
2) Include citations/links where possible for traceability
3) Add the case to `kit-mapping.json`
4) Validate with `npm run sps:validate`
5) Try both audiences in the UI and confirm expected content separation

---

## FAQ

Q: Do students ever see faculty-only ground truth?

A: No. Audience filtering occurs before retrieval/injection. The validator also warns if ground truth isn’t marked faculty-only.

Q: What if a scenario has no mapping?

A: The backend uses a safe default mapping and still composes instructions without crashing.

Q: Can chunks be role-specific?

A: Yes. Use the `roles` field to target specific roles (e.g., translator) while still respecting audience and phases.

---

## Related docs

- `SPS_INSTRUCTION_PIPELINE.md` — Instruction composition layers
- `SPS_ROLES_EXTENSIBILITY.md` — Role directives and schema-light roles
- `SPS_AGENTIC_HYBRID_IMPLEMENTATION_PLAN.md` — Strategy and rollout plan
