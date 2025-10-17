# LLM Case Generation Prompt Kit (Entry-level DPT)

This guide provides a plug-and-play prompt kit to generate entry-level DPT Clinical Scenarios that save cleanly into the SPS system. It complements (does not replace) [SPS_CONTENT_AUTHORING.md](SPS_CONTENT_AUTHORING.md) by focusing on AI prompt structure and JSON output, while the authoring guide covers content workflow and compilation.

> **📖 Content Workflow:** After generating scenarios with this kit, use [SPS_CONTENT_AUTHORING.md](SPS_CONTENT_AUTHORING.md) for manual authoring, compilation, validation, and version control.

## How this fits with existing guidance

- Use this when you want an LLM to draft new cases. After generation, you can optionally integrate via the authoring workflow described in `SPS_CONTENT_AUTHORING.md`.
- JSON output matches our runtime schema expectations and can be saved directly via `/api/sps/scenarios`.
- This kit enforces enums and a minimal JSON contract to reduce post-editing.

---

## Inputs to collect per case

Provide these variables to the prompt:

- Core metadata
  - `region`: one of [hip, knee, ankle_foot, shoulder, cervical_spine, lumbar_spine, thoracic_spine, elbow, wrist_hand, sports_trauma_general]
  - `difficulty`: one of [easy, moderate, advanced] (use `easy` for entry-level)
  - `setting`: one of [primary_care_pt, sports_rehab, post_op, acute, telehealth, outpatient_pt, sports_pt_outpatient, sports_medicine_outpatient, sports_rehab_clinic]
  - `entry_level`: boolean (true for MVP)
  - `tags`: string[] (include `entry_level_dpt`)
- Learning objectives constraints
  - `objectives_count`: number (2–4)
  - `bloom_level`: one of [apply, analyze, evaluate, create]
  - `npte`: { system, domain, nonsystem } using enums listed below
  - `assessment_focus`: subset of [safety, clinical_reasoning, patient_education]
- Evidence
  - `evidence_level`: one of [CPG, systematic_review, RCT]
  - `research`: boolean (true to allow brief plausible citations)
- Persona
  - `persona_snapshot`: { display_name?, headline?, age?, sex? }
- Safety
  - `include_red_yellow_flags`: boolean (true)
  - `excluded_content`: optional notes (e.g., avoid post-op protocols)

---

## System prompt template

You are an expert physical therapy educator designing entry-level Doctor of Physical Therapy (DPT) clinical scenarios for teaching and assessment. Your goal is to produce realistic, safe, and concise cases aligned with NPTE/CAPTE expectations and ready for use in a simulated patient session.

Rules:

- Output strictly valid JSON matching the contract provided. Do not include explanations, markdown, or comments.
- Follow enumerations exactly for all enum fields (region, difficulty, setting, bloom_level, etc.).
- Patient-friendly, succinct language. Avoid jargon unless explained briefly.
- Prioritize safety: include red/yellow flag screening and ensure consistency between flags and narrative.
- Evidence: include 1–2 sources at the specified evidence level with identifiers (guideline title/year or DOI/PMID if known; otherwise a clear placeholder).
- Keep complexity appropriate for entry-level if `entry_level=true`.
- If any required field cannot be justified, use a reasonable placeholder and keep it consistent.

Output format:

- JSON only
- All strings concise
- Prefer arrays over null (omit optional fields if unknown)

---

## User prompt template

Create a ClinicalScenario for an entry-level DPT training program with the following constraints:

- region: {region}
- difficulty: {difficulty}
- setting: {setting}
- entry_level: {entry_level}
- target_objectives_count: {objectives_count}
- bloom_level: {bloom_level}
- npte_map: {"system":"{npte.system}","domain":"{npte.domain}","nonsystem":"{npte.nonsystem}"}
- assessment_focus: {assessment_focus as JSON array}
- evidence_level: {evidence_level}
- research: {research}
- tags: {tags as JSON array}
- persona_snapshot_hint (optional): {display_name/headline/age/sex if given; otherwise infer typical values}

Scenario characteristics:

- Common outpatient presentation consistent with the region and entry-level scope.
- Include chief complaint, onset, 24‑hour pattern, aggravators/easers, pain ratings.
- Screening: relevant red/yellow flag denials or ruled-out status aligned with presentation.
- Objective: vitals, observation, regional ROM/MMT, 2–3 special tests (plausible template IDs), 1 functional test, 1 outcome measure.
- Assessment: succinct impression, top differentials, simple prognosis.
- Plan: basic frequency/duration, 2–3 interventions with simple dosing, 1–2 patient education topics, and safety netting.

Return JSON matching the contract exactly. Use `scenario_id: "new_scenario_id"`, set `schema_version: "3.0"` and `status: "draft"`.

---

## Minimal JSON contract (aligned with runtime)

Required core:

- `schema_version`: string (e.g., "3.0")
- `scenario_id`: "new_scenario_id"
- `status`: "draft" | "published"
- `title`: string
- `region`: enum listed above
- `difficulty`: enum [easy, moderate, advanced]
- `setting`: enum listed above
- `tags`: string[] (include `entry_level_dpt` when entry_level=true)

Persona:

- `persona_snapshot`: { id?: string; display_name?: string|null; headline?: string|null; age?: number|null; sex?: string|null }

Pedagogy:

- `pedagogy`: { learning_objectives: Array<{ id:string; text:string; bloom_level:'apply'|'analyze'|'evaluate'|'create'; capte_refs:string[]; npte_map:{ system; domain; nonsystem }; assessment_focus:Array<'safety'|'clinical_reasoning'|'patient_education'>; evidence_req:'CPG'|'systematic_review'|'RCT' }>; performance_rubric_ref?: string; feedback_bank_keys?: string[]; debrief_prompts?: string[] }

Presenting problem:

- `presenting_problem`: { primary_dx:string; onset:'acute'|'gradual'|'insidious'; duration_weeks:number; dominant_symptoms:string[]; pain_nrs_rest:number; pain_nrs_activity:number; aggravators:string[]; easers:string[]; pattern_24h:string; red_flags_ruled_out:boolean }

ICF:

- `icf`: { health_condition:string; body_functions_structures:string[]; activities:string[]; participation:string[]; environmental_factors:string[]; personal_factors:string[] }

Instructions:

- `instructions`: { sp_instructions:{ affect:'calm'|'anxious'|'frustrated'|'guarded'; pain_behavior:string; cueing_rules:string[] }; llm_prompt_hooks:{ coaching_cues:string[]; deflection_lines?:string[] }; authoring_notes?:string }

SOAP:

- `soap`: { subjective:{ ... }; objective:{ ... }; assessment:{ ... }; plan:{ ... } } (see `Case Builder` types for field details)

Provenance:

- `provenance`: { sources:Array<{ title:string; identifier:string; level_of_evidence:'CPG'|'systematic_review'|'RCT' }>; reviewers:string[]; last_reviewed:string }

Notes:

- Keep arrays small and focused (e.g., 2–3 special tests).
- Ensure consistency (e.g., if `red_flags_ruled_out` is true, do not include red flag positives elsewhere).

---

## Staged generation workflow (recommended)

1. Outline

- Ask the model to return only: `title`, core meta, `persona_snapshot`, `pedagogy.learning_objectives`, and `presenting_problem`.
- Validate enums and counts. If invalid, retry with a compact error hint.

1. Expand

- Provide the approved outline back with: "expand to full `soap`, `instructions`, `icf`, `provenance`; keep all prior fields identical; concise language".

1. Validate & patch

- Run your validator. If issues remain, send a correction prompt listing failing paths and allowed values. Ask for full JSON re‑emit.

---

## Example (trimmed)

Input variables (example):

```bash
region=hip
difficulty=easy
setting=outpatient_pt
entry_level=true
objectives_count=3
bloom_level=apply
npte.system=musculoskeletal
npte.domain=examination
npte.nonsystem=safety
assessment_focus=["safety","clinical_reasoning"]
evidence_level=CPG
research=true
tags=["entry_level_dpt","hip_pain","running"]
```

Model output (skeleton):

```json
{ "schema_version": "3.0", "scenario_id": "new_scenario_id", "status": "draft", "title": "Gradual Onset Lateral Hip Pain in Recreational Runner", "region": "hip", "difficulty": "easy", "setting": "outpatient_pt", "tags": ["entry_level_dpt","hip_pain","running"], "persona_snapshot": {"display_name":"Alex","headline":"Wants to run 5K without pain","age":29,"sex":"female"}, "pedagogy": { "learning_objectives": [ { "id":"LO1", "text":"Apply region-specific special tests to differentiate lateral hip pain syndromes.", "bloom_level":"apply", "capte_refs":["7D1","7D2"], "npte_map":{"system":"musculoskeletal","domain":"examination","nonsystem":"safety"}, "assessment_focus":["clinical_reasoning","safety"], "evidence_req":"CPG" } ], "performance_rubric_ref":"rubric_basic_eval_v1", "debrief_prompts":["What findings ruled out red flags?"] }, "presenting_problem": { "primary_dx":"Greater trochanteric pain syndrome", "onset":"gradual", "duration_weeks":6, "dominant_symptoms":["lateral hip ache","tenderness over GT"], "pain_nrs_rest":1, "pain_nrs_activity":5, "aggravators":["running >2 miles","side-lying on affected side"], "easers":["rest","ice"], "pattern_24h":"stiff AM, better mid-day, aches after runs", "red_flags_ruled_out":true }, "icf": { "health_condition":"GTPS", "body_functions_structures":["gluteal tendinopathy","bursal irritation"], "activities":["running tolerance reduced"], "participation":["community 5K participation limited"], "environmental_factors":["concrete running surface"], "personal_factors":["increased training load"] }, "instructions": { "sp_instructions": { "affect":"calm", "pain_behavior":"mild guarding on palpation", "cueing_rules":["avoid diagnosing; answer with lived experience"] }, "llm_prompt_hooks": { "coaching_cues":["ask about training changes","screen night pain/systemic symptoms"] } }, "soap": { "subjective": { "chief_complaint":"Lateral hip pain with running" /* ... trimmed ... */ }, "objective": { "vitals": { "bp_mmHg": {"systolic":112, "diastolic":72 }, "hr_bpm":62, "rr_bpm":12, "spo2_percent":99, "temperature_c":36.7, "position":"seated" } /* ... */ }, "assessment": { /* ... */ }, "plan": { /* ... */ } }, "provenance": { "sources": [ { "title": "2022 CPG: Greater Trochanteric Pain Syndrome", "identifier": "CPG-2022-GTPS", "level_of_evidence": "CPG" } ], "reviewers": ["faculty_reviewer"], "last_reviewed": "2025-10-16" } }
```

---

## After generation: save or author

- Save immediately via `POST /api/sps/scenarios` (server will assign an ID if you keep `scenario_id: "new_scenario_id"`).
- Or place the JSON under the authoring workflow, compile, and validate (`SPS_CONTENT_AUTHORING.md`).

## Enumerations (reference)

- Regions: hip, knee, ankle_foot, shoulder, cervical_spine, lumbar_spine, thoracic_spine, elbow, wrist_hand, sports_trauma_general
- Difficulty: easy, moderate, advanced
- Setting: primary_care_pt, sports_rehab, post_op, acute, telehealth, outpatient_pt, sports_pt_outpatient, sports_medicine_outpatient, sports_rehab_clinic
- Bloom: apply, analyze, evaluate, create
- Assessment focus: safety, clinical_reasoning, patient_education
- Evidence level: CPG, systematic_review, RCT
