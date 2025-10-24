# Agentic Hybrid Implementation Plan (SPS)

Last Updated: 2025-10-23

This plan adds an agentic, retrieval‑grounded layer to the current SPS system while preserving all existing functionality. It enables realistic, role‑authentic behavior that stays grounded in rich clinical facts, without forcing a rigid schema.

---

## goals and non‑goals

Goals

- Realistic, role‑authentic responses (patient, translator, family, clinician, scribe, custom)
- Ground answers in rich clinical facts specific to each case
- Preserve current SPS flows (persona/scenario/gates/phase/media) and latency targets
- Keep authoring flexible (schema‑light) while supporting validation and versioning

Non‑goals (initially)

- No mandatory UI for authoring; all content authoring can be file‑based
- No hard dependency on embeddings from day one (start with keyword/TF‑IDF; upgrade later)

Success Criteria

- Instruction size ≤ ~2–3 KB; initial turn latency within current SLO
- Role authenticity: contracts consistently enforced (e.g., translator never gives advice)
- Grounding: retrieved facts appear when relevant; hallucinations minimized
- Backward compatibility: existing cases run unchanged (default role = patient)

---

## architecture overview

Core components

- Role Agents: small contracts per role (instruction, do/don’t, language/voice hints)
- Scenario Kits: compact per‑case knowledge packs (chunks/snippets) with tags/filters
- Router: selects active agent and fetches applicable kit snippets
- Composer: merges layers → baseline → role contract → retrieved facts → scenario snapshot → media → phase → gates
- Output Enforcer: light post‑checks for role compliance and format
- Cache: caches assembled instructions by (case, role, phase, gate, kit_signature)

Two integration modes

- Stage 1 (Static Injection): retrieve once at session start and bake into system prompt
- Stage 2 (Per‑Turn Augmentation): proxy the Realtime session and inject fresh facts each user turn

---

## data model (schema‑light)

### Agents (roles)

File: `backend/sps/agents/<role_id>.json`

```json
{
  "id": "translator",
  "instruction": "Translate faithfully between es↔en. Do not provide medical advice. Keep it short. If asked for literal translation, preserve word order.",
  "reply_language": "en",
  "voice_id": null,
  "do": ["Faithful meaning", "Confidentiality"],
  "dont": ["No clinical recommendations", "No hidden notes"]
}
```

Notes

- Keep instruction ≤ 10 lines for latency
- `do/dont` are consumed by the Output Enforcer (optional)

### Scenario Kits (RAG)

File: `backend/sps/kits/<case_id>/kit.json`

```json
{
  "case_id": "knee_acl_v1",
  "version": 1,
  "provenance": { "sources": ["ref1", "ref2"], "reviewers": ["clinician_id"], "last_reviewed": "2025-10-20" },
  "chunks": [
    {
      "id": "pp1",
      "text": "Twisting injury during soccer; immediate swelling; audible pop.",
      "tags": ["presenting_problem"],
      "roles": ["patient","clinician"],
      "phases": ["subjective"],
      "weight": 0.9
    },
    {
      "id": "imaging1",
      "text": "MRI shows ACL tear; menisci intact.",
      "tags": ["imaging"],
      "phases": ["objective","treatment_plan"],
      "media_ids": ["knee_mri_t2"],
      "weight": 0.8
    },
    {
      "id": "guard1",
      "text": "Avoid impact testing unless cleared; pain 6/10 on pivot.",
      "tags": ["guardrail"],
      "phases": ["objective"],
      "weight": 0.8
    }
  ]
}
```

Notes

- Chunk `text` is the ground truth fact; keep each ≤ 200 chars when possible
- Filters (tags/roles/phases) reduce candidate set per turn/session
- Provenance supports standardization and audits

### Optional Case Snapshot

File: `backend/sps/kits/<case_id>/snapshot.json`

```json
{
  "title": "ACL tear after pivot",
  "presenting_problem": { "primary_dx": "ACL tear", "dominant_symptoms": ["instability","swelling"] },
  "context": { "setting": "sports_rehab_clinic" },
  "media_library": [{ "id":"knee_mri_t2", "type":"image", "url":"...", "caption":"MRI T2 axial" }]
}
```

This feeds a 1–3 bullet scenario blurb (not the main knowledge source).

---

## retrieval strategy

Phase 1 (simple)

- Keyword/TF‑IDF over kit.chunks; score = keyword hits × weight × role/phase filter bonus
- Top‑k = 2–4; max combined length ~600 chars

Phase 2 (upgrade)

- Add a small embedding index per kit (dimension and provider TBD)
- Hybrid score: α·keyword + (1−α)·semantic; tune α empirically

Shaping & de‑duplication

- Merge similar hits; prefer more specific/phase‑aligned chunks
- Strip redundant punctuation; keep “facts only” phrasing

---

## composer integration (preserving current behavior)

Current composition (simplified):

- Baseline (safety/format)
- Persona snapshot → Scenario snapshot → Media guidance → Phase guidance → Gates

New layering (agentic hybrid):

- Baseline (unchanged)
- Agent contract (by role)
- Retrieved facts (top‑k from kit)
- Scenario snapshot (brief)
- Media guidance (unchanged, with IDs)
- Phase guidance & Gates (unchanged)

Caching key

- `(case_id, role_id, phase, gate_hash, kit_signature)` → assembled instructions

Size budget

- Agent instruction ≤ ~10 lines
- Retrieved facts ≤ ~600 chars combined
- Total instructions ≤ ~2–3 KB

---

## API and runtime changes

Stage 1 (Static Injection)

- POST `/api/voice/token`
  - Accepts: `role_id` (already supported), `reply_language?`
  - Server loads agent + kit, retrieves top‑k (using phase/role), composes instructions
  - Applies `agent.reply_language` if request doesn’t specify
  - Response unchanged structure; include `context.role_id`

- POST `/api/voice/instructions`
  - Accept: `role_id?`, `phase?`, `gate?`
  - Return: `{ instructions, phase, outstanding_gate, role_id, available_roles, retrieved_ids? }`

Optional (debug/authoring)

- GET `/api/sps/agents` → list installed agents
- GET `/api/sps/kits/:caseId` → kit metadata (no full text by default)

Stage 2 (Per‑Turn Augmentation)

- Add server proxy for Realtime events
- On each user turn: detect intent, retrieve top‑k, inject context prior to model response

---

## validation and standardization

Zod Schemas

- `AgentSchema`: id, instruction, reply_language?, voice_id?, do?, dont?
- `KitSchema`: case_id, version, provenance?, chunks[] with: id, text, tags?, roles?, phases?, weight?, media_ids?

CLI Validators

- `npm run sps:validate:agents` and `:kits` print errors/warnings and summary metrics
- CI gate: fail on schema errors or excessive lengths

Provenance & Versioning

- Require `provenance` fields for kits entering production
- Track `version` and emit a `kit_signature` for caching/observability

---

## testing plan

- Snapshot Tests
  - Same case, different roles → compare outputs (patient vs translator vs clinician)
  - Enforce “translator never advises”; “scribe summarizes neutrally”

- Retrieval Tests
  - Given representative queries (or phase), top‑k ids match expectations

- Latency & Size Tests
  - Instruction size within budget; token route time stays within SLO

- Integration Tests
  - /voice/instructions returns available_roles and retrieved_ids
  - /voice/token composes role+facts and applies reply_language/voice correctly

---

## observability

- Log retrieved chunk IDs and final instruction size per session (debug mode)
- Add `/api/voice/instructions` preview here-and-now return of ids
- Optional: “explain” endpoint that shows scoring per chunk for QA

---

## security & privacy

- Kits contain only scenario‑approved content (no real PHI)
- Optional redaction pass in Output Enforcer (guard against leaking author notes)
- Ensure translator doesn’t inadvertently expose internal guidance

---

## performance considerations

- Keep kits small (≤ 50–150 chunks) and filtered by role/phase
- Precompute simple inverted index per kit for keyword search
- Cache assembled prompts; invalidate on role/phase/gate or kit_signature change

---

## rollout plan (phased)

Phase 0: Foundations (1–2 days)

- Add agents/ and kits/ directories and Zod schemas + validators
- Implement simple keyword retriever + scoring
- Extend composer to accept `{ role_id, retrievedFacts[] }`

Phase 1: Static Injection (2–3 days)

- Enhance `/voice/token` to compose with role + retrieved facts
- Extend `/voice/instructions` to return `available_roles` and `retrieved_ids`
- Add tests: snapshot, retrieval, latency budget

Phase 2: Authoring & QA Tools (1–2 days)

- CLI helpers to compile/validate kits, print stats, check length budgets
- Optional debug routes `/sps/agents`, `/sps/kits/:caseId`

Phase 3: Per‑Turn Augmentation (2–4 days)

- Add server proxy loop for Realtime (user turn capture)
- Retrieve per turn and inject context prior to response
- Add intent/routing stub (regex + tags) and tests

---

## work breakdown (tasks)

1. Content & Validation

- Create Zod schemas for Agent and Kit
- Implement `scripts/sps-validate-agents.ts` and `scripts/sps-validate-kits.ts`
- Document authoring rules (max lengths, tags, roles/phases)

1. Retrieval

- Implement keyword/TF‑IDF retriever with role/phase filters
- Add de‑dup/merge and length shaping

1. Composer Integration

- Add role directive section and retrieved facts section
- Respect reply_language/voice hints
- Keep media/phase/gates layering as-is

1. API & Wiring

- Update `/voice/token` and `/voice/instructions` to accept role_id and include retrieved_ids
- Add optional debug routes

1. Tests & QA

- Snapshot tests for roles
- Retrieval correctness tests
- Latency & size checks with budgets

1. Optional Per‑Turn Proxy

- Implement event proxy
- Inject retrieval on each turn; add routing/intent heuristics

---

## risks and mitigations

- Instruction bloat → Enforce budgets, tests, and shaping
- Retrieval irrelevance → Start small, filter by role/phase/tags, add weighting; upgrade to embeddings later
- Role bleed → Strong agent contracts + output enforcer + tests
- Authoring load → Provide templates, validators, and kit statistics

---

## acceptance criteria (MVP)

- For a pilot case (e.g., knee_acl_v1), the system produces distinct, grounded outputs for Patient and Translator roles with:
  - Instruction size < 3 KB; retrieved facts included; role rules enforced
  - `/voice/instructions` returns `available_roles` and `retrieved_ids`
  - All tests pass; validators report no schema errors; latency budget respected

---

## next steps

- Approve this plan
- I’ll scaffold agents/kits schemas + validators and extend the composer and routes for Stage 1
- Author one pilot kit and two agent contracts; add snapshot/retrieval tests; iterate
