# Scenario/Persona System Architecture Analysis

## Problem Statement
AI personas are refusing to share their full name and date of birth, and may be confused about their role as standardized patients.

## Current System Architecture

### 1. Data Sources & Loading

#### A. Realtime Personas (`realtime_personas.json`)
- Location: `backend/src/sps/data/personas/realtime_personas.json`
- Contains: Pre-built personas with voice IDs, DOB, names
- Converted by: `convertRealtimePersona()` in `session.ts`
- Properties include: `firstName`, `lastName`, `dateOfBirth`, `voice`, etc.

#### B. Scenario Bundles (v3 structure)

- Location: `backend/src/sps/data/scenarios_v3/[scenario_name]/`
- Each bundle contains:
  - `scenario.header.json` - metadata, ICF, presenting problem; includes `linkage.persona_id`
  - `instructions.json` - SP instructions and cueing rules
  - `soap.subjective.json` - history data
  - `soap.objective.json` - exam findings
  - `soap.assessment.json` - clinical reasoning
  - `soap.plan.json` - treatment plan
  - `acute_care.module.json` (optional) - linkage info

#### C. Scenario Personas (centralized store)

- Location: `backend/src/sps/data/personas/scenario/[persona_id].json`
- Purpose: reusable persona definitions referenced by multiple scenarios
- Linked via: `scenario.header.json > linkage.persona_id`

#### D. Loading Process (`loadSPSContent()` in `session.ts`)

1. Loads realtime personas → converts → adds to registry
2. Scans `scenarios_v3` directories
3. Loads centralized scenario personas into memory
4. For each bundle:
   - Reads linkage files (instructions, SOAP sections, modules)
   - Resolves the persona via `linkage.persona_id`
   - Calls `convertScenarioBundle()` to create `ClinicalScenario`
   - Adds resolved personas and scenarios to `SPSRegistry`

### 2. Persona Conversion Pipeline

#### `convertRealtimePersona()` → Creates personas from realtime_personas.json

- Extracts: `firstName`, `lastName`, `dateOfBirth`
- Computes age from DOB
- Creates `demographics.dob` field
- Calls `buildDobChallenges(displayName, safeDob)`
- Returns: `PatientPersona` with `dob_challenges` array

#### `convertPersonaBundle()` → Creates personas from centralized scenario personas

- Uses persona JSON from `backend/src/sps/data/personas/scenario`
- Gets age directly, computes DOB via `coerceDob(age)`
- Creates `demographics.dob` field
- Calls `buildDobChallenges(name, demographics.dob)`
- Returns: `PatientPersona` with `dob_challenges` array

#### `buildDobChallenges()` → Creates example responses

```typescript
function buildDobChallenges(name: string, dob: string) {
  const who = name || 'Patient';
  return [
    { style: 'straightforward', example_response: `${who}, ${dob}.` },
    { style: 'clarification', example_response: `${who}. Date of birth ${dob}.` },
  ];
}
```

### 3. Active Case Composition

#### `SPSRegistry.composeActiveCase(personaId, scenarioId)`

- Retrieves persona and scenario from registry
- Validates age/sex guardrails
- Returns: `ActiveCase { id, persona, scenario }`

### 4. Instructions Building

#### `composeRealtimeInstructions()` in `sps.service.ts`

Assembles the system prompt by combining:

1. **GOLD_STANDARD_SPS_INSTRUCTIONS** - Core behavior rules
2. **buildPersonaSection()** - Persona snapshot
3. **buildScenarioSection()** - Scenario context
4. **Phase guidance** - Current phase instructions

#### `buildPersonaSection()` → CURRENT IMPLEMENTATION

```typescript
function buildPersonaSection(persona?: ActiveCase['persona'] | null): string {
  const demographics = persona.demographics || {};
  const name = demographics.preferred_name || demographics.name || persona.patient_id || 'Patient';
  const lines = ['Persona snapshot:'];
  lines.push(`- Identity: ${identityBits.join(' ')}`);  // Name, pronouns, age
  
  // ⚠️ MISSING: Full name and DOB are NOT included here!
  // The demographics.dob exists but is never added to the prompt
  
  if (demographics.occupation) lines.push(`- Occupation: ${demographics.occupation}`);
  if (persona.dialogue_style?.tone) lines.push(`- Tone: ${persona.dialogue_style.tone}`);
  // ... other fields
  return lines.join('\n');
}
```

### 5. The Problem

#### Issue #1: DOB Data Exists But Not Passed to AI

- ✅ DOB is loaded from source files
- ✅ DOB is stored in `demographics.dob`
- ✅ `dob_challenges` are created (but never used)
- ❌ DOB is NEVER included in `buildPersonaSection()`
- ❌ AI never sees the full name or DOB in its system prompt

#### Issue #2: No Clear Identity Instructions

- The `GOLD_STANDARD_SPS_INSTRUCTIONS` doesn't explicitly tell the AI:
  - That it should share its full name and DOB when asked
  - That this is standard healthcare identity verification
  - That refusing to share this info breaks the simulation

#### Issue #3: Potential Privacy Confusion

- Modern AI models are trained to be privacy-conscious
- Without explicit instructions, they may think sharing DOB is inappropriate
- They may not understand they ARE the patient (not assisting a patient)

### 6. Legacy Code Concerns

#### Multiple persona sources

- Old `personas` table in database (legacy)
- Realtime personas (current)
- Scenario bundle personas (current)
- May have conflicting data structures

#### Multiple instruction files

- `instructions.ts` - Core gold standard
- `instructions.json` per scenario - SP-specific cues
- May have conflicting guidance

### 7. Solution Strategy

#### Fix #1: Update `buildPersonaSection()`

Add full name and DOB to the persona section that gets sent to AI:

```typescript
const fullName = demographics.name || name;
const dob = demographics.dob;
if (fullName) lines.push(`- Full name: ${fullName}`);
if (dob) lines.push(`- Date of birth: ${dob}`);
```

#### Fix #2: Update `GOLD_STANDARD_SPS_INSTRUCTIONS`

Add explicit guidance about identity sharing:

- State clearly: "You ARE a standardized patient"
- Add identity verification section under SUBJECTIVE
- Explain this is routine healthcare practice
- Example responses for name/DOB questions

#### Fix #3: Consider Using `dob_challenges`

The `dob_challenges` array already has example responses but is never used.
Could integrate these into the instructions.

## Files Requiring Changes

### Critical

- ✅ `backend/src/sps/runtime/sps.service.ts` - `buildPersonaSection()`
- ⚠️ `backend/src/sps/core/instructions.ts` - GOLD_STANDARD_SPS_INSTRUCTIONS (currently corrupted, needs recreation)

### Supporting

- `backend/src/sps/runtime/session.ts` - Consider utilizing `dob_challenges`

## Data Flow Summary

```text
Source Files (JSON)
    ↓
loadSPSContent()
    ↓
convertRealtimePersona() / convertPersonaBundle()
    ↓
PatientPersona (with demographics.dob + dob_challenges)
    ↓
SPSRegistry
    ↓
composeActiveCase()
    ↓
ActiveCase { persona, scenario }
    ↓
composeRealtimeInstructions()
    ↓
buildPersonaSection() ← ⚠️ DOB gets dropped here!
    ↓
AI System Prompt (missing DOB/full name)
```

## Next Steps

1. ✅ Fix `buildPersonaSection()` to include full name and DOB
2. 🔧 Recreate `instructions.ts` with identity verification guidance
3. 🧪 Test with actual session to verify AI shares identity info
4. 📝 Consider cleanup of legacy persona code if not in use
