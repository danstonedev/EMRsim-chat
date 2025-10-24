# SPS Instruction Pipeline

This document explains how the simulator decides what to say, how conflicts are resolved, and where to extend the system. It reflects the current implementation and proposes small, backwards-compatible hooks you can use to grow it.

## overview

At runtime we build a single instruction string (system message) for the model by layering multiple sources:

1) Gold baseline rules (global guardrails and style)
2) Persona snapshot (identity, tone, voice hints)
3) Scenario snapshot (presenting problem, key facts, setting)
4) Media guidance (when/how to include [MEDIA:id] markers)
5) Phase guidance (subjective → objective → treatment emphasis)
6) Gate context (what’s still outstanding: greeting, consent, identity, etc.)

These layers are composed into a single concise instruction optimized for real-time latency.

## composition contract

Inputs

- activeCase: { persona, scenario }
- phase: one of subjective | objective | treatment (string)
- gate: normalized gate flags object
- outstandingGate: derived array of gate items still required

Output

- instructions: string suitable for the model’s system prompt

Success criteria

- Correct precedence: no contradictions vs. baseline safety; scenario beats persona for scenario facts; persona beats stylistic defaults.
- Brevity: single-utterance guidance; include media markers only when policy allows.
- Phase accuracy: emphasize the current phase without leaking future steps.
- Gate compliance: clearly state what remains to be covered so the model completes it next.

## precedence and conflict resolution

From strongest to weakest:

1) Safety & non-negotiables (baseline safety rules)
2) Scenario facts (clinical truth of the case)
3) Role instructions (if roles are used; see Roles doc)
4) Persona instructions (identity, speech style)
5) Hidden agenda (if present)
6) Baseline communication style

When two layers conflict, the higher item wins. For example, if persona says "avoid medical jargon" but the scenario requires a specific medication name, the scenario fact wins; the instruction should ask to state it simply while preserving accuracy.

## where the code lives

- Instruction text assembly: `backend/src/sps/runtime/sps.service.ts` → `composeRealtimeInstructions()`
- Baseline rules: `backend/src/sps/core/instructions.ts` (GOLD_STANDARD_SPS_INSTRUCTIONS)
- Active case resolution: `backend/src/sps/core/registry.ts` and `backend/src/sps/runtime/content/loader.ts`
- Session/gate defaults: `backend/src/sps/runtime/store.ts`
- Injection points:
  - Voice token: `backend/src/routes/voice.ts` (POST `/voice/token`) — composes instructions from the session, or stateless via persona/scenario IDs.
  - Instruction preview: `backend/src/routes/voice.ts` (POST `/voice/instructions`) — allows overrides of phase/gate, returns composed text and outstanding gate items.
  - Catalog APIs: `backend/src/routes/sps.ts` for personas, scenarios, and baseline export.

## example (illustrative)

Given:

- Persona: "Alex Kim", age 28, friendly, concise, avoids jargon.
- Scenario: "Migraine with aura" — photophobia, throbbing unilateral pain, triggered by stress.
- Phase: subjective; outstanding gate: [greeting, consent].

The composed instruction will include:

- Baseline guardrails (safety, single-utterance, brevity)
- Persona style cues (friendly, concise)
- Scenario snapshot (migraine features) for internal context
- Phase emphasis (focus on history of present illness)
- Gate reminder (still needs greeting and consent next)
- Media policy (include `[MEDIA:...]` if available and relevant)

Resulting structure (simplified):

- You are a standardized patient simulator. Follow safety rules…
- Persona: Alex Kim (they/them), 28; friendly, concise, lay terms.
- Scenario: Migraine with aura; photophobia, unilateral throbbing; stress trigger.
- Phase: Subjective; focus on history, symptoms, triggers.
- Outstanding: Greet the clinician and obtain consent before details.
- Media: If the clinician requests or it aids clarity, reference available media with `[MEDIA:ID]`.

## how to extend safely

- Add personas or scenarios: drop new files into the content folders that the registry/loader consumes. They’ll be exposed via `/sps/personas` and `/sps/scenarios`.
- Adjust gate/phase: POST `/voice/instructions` with overrides to confirm instruction output before wiring UI.
- Media additions: register assets and ensure they surface in the media guidance portion so the model knows when/how to include `[MEDIA:id]`.

## performance notes

- Keep instruction blocks succinct; trim redundancy across persona/scenario texts.
- Cache compiled instructions for the tuple (persona, scenario, phase, gate, role?) to avoid recomputation during a session.
- For voice, prefer the low-latency STT model already configured, and keep instruction size below ~2–3 KB to minimize initial token latency.

## next: roles and extensibility

For multi-role encounters (translator, family member, clinician, scribe), see `SPS_ROLES_EXTENSIBILITY.md` for a schema-light approach that remains backwards compatible and easy to author.
