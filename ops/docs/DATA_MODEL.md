# Data Model (Progressive)

## v0.1 — Core

### personas

- id (uuid)
- display_name (string)
- system_directives (text)
- answer_style? (text)
- no_go_topics? (text[])
- speaking_rate? ('slow'|'avg'|'fast')
- voice_id? (string)
- created_at, updated_at

### sessions

- id (uuid)
- persona_id (fk personas.id)
- mode ('text'|'voice')
- started_at, ended_at
- metrics_json (jsonb)

### turns

- id (uuid)
- session_id (fk sessions.id)
- role ('user'|'assistant'|'system')
- text (text)
- audio_ms? (int)
- tokens_in? (int)
- tokens_out? (int)
- timings_json (jsonb)
- created_at

## v0.6 — Assessment

### scenarios

- id (uuid)
- title (string)
- objectives (text[])
- disclosure_schedule (jsonb)  // cue, evidence, strictness, content
- strictness (int 0–2)
- status ('draft'|'review'|'published')
- version (int)
- created_at, updated_at

### rubrics

- id (uuid)
- scenario_id (fk scenarios.id)
- criteria (jsonb)  // { name, weight, threshold, notes? }

### grades

- session_id (fk sessions.id)
- scenario_id (fk scenarios.id)
- rubric_scores_json (jsonb)
- total_score (float)
- grader ('auto'|'instructor')
- created_at

### turn_annotations

- turn_id (fk turns.id)
- asked_required_probe (bool)
- missed_critical (bool)
- empathy_markers (text[])
- jargon_flags (text[])

## v0.7 — Governance & Ops

### users

- id, role ('student'|'instructor'|'admin'), realm_id (fk realms.id)

### realms

- id, name, policy_id (fk policies.id)

### policies

- id
- retention_days_transcripts (int)
- retention_days_grades (int)
- export_allowed (bool)

### content_reviews

- entity_type ('persona'|'scenario'|'rubric')
- entity_id
- checklist_json
- reviewer
- status ('approved'|'changes'|'rejected')
- notes
- timestamp

### usage_counters

- scope ('user'|'realm'|'scenario'), key
- tokens_in, tokens_out
- audio_sec_in, audio_sec_out
- window_start, window_end

### perf_snapshots

- session_id
- metrics_json  // p50/p95 for stt/llm/tts
- created_at

## Portability

- Export/import **bundles**: scenario.header.json (persona_id link), scenario.json, rubric.json, media/
- Include centralized persona definitions from `backend/src/sps/data/personas/scenario/*.json` when porting.
- Keep IDs stable across imports; track version.
