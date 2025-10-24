# SPS Scenario Authoring Guide for Partners

> **Complete guide for creating clinical scenarios in the EMRsim SPS (Scenario-Persona-System) framework**

## Table of Contents

1. [Quick Start](#quick-start)
2. [Content Structure](#content-structure)
3. [Required Elements Checklist](#required-elements-checklist)
4. [Patient Role Declaration (REQUIRED)](#patient-role-declaration-required)
5. [Authoring Workflow](#authoring-workflow)
6. [Metadata Requirements](#metadata-requirements)
7. [Content Quality Guidelines](#content-quality-guidelines)
8. [Compilation & Validation](#compilation--validation)
9. [Common Mistakes to Avoid](#common-mistakes-to-avoid)
10. [AI-Assisted Authoring](#ai-assisted-authoring)
11. [Troubleshooting](#troubleshooting)

---

## Quick Start

### What You're Creating

Each scenario is a standardized patient case that students interact with through voice or chat. You'll define:

- **Clinical presentation** - The patient's condition, symptoms, and history
- **Learning objectives** - What students should learn from this case
- **Patient behavior** - How the AI should act as the patient
- **Objective findings** - Physical exam results and tests
- **SOAP documentation** - Complete clinical documentation

### File Structure

```
backend/src/sps/content/scenarios/bundles_src/<scenario_id>/
├── scenario.header.json      # Metadata, pedagogy, roles
├── instructions.json          # Scenario-specific AI instructions
├── soap.subjective.json       # Patient history content
├── soap.objective.json        # Physical exam findings
├── soap.assessment.json       # Assessment and diagnosis
└── soap.plan.json            # Treatment plan
```

---

## Content Structure

### Overall Architecture

```text
backend/src/sps/
  content/                 # Runtime content (automatically generated)
    personas/
      realtime/*.json      # Canonical personas
      shared/*.json        # Shared personas across scenarios
    scenarios/
      compiled/*.json      # Single-file compiled scenarios (auto-generated)
    banks/
      modules/**           # Shared module definitions
      catalogs/**          # Test templates, interventions, etc.
      
  authoring/               # Where you work!
    bundles_src/<scenario_id>/*  # Your scenario files
    templates/**                 # Copy these to start new scenarios
```

---

## Required Elements Checklist

Use this checklist when creating or reviewing scenarios:

### Required Files

- [ ] `scenario.header.json` - Metadata, pedagogy, and role definitions
- [ ] `instructions.json` - Scenario-specific instructions
- [ ] `soap.subjective.json` - Subjective history content
- [ ] `soap.objective.json` - Objective findings and tests
- [ ] `soap.assessment.json` - Assessment content
- [ ] `soap.plan.json` - Treatment plan content

### Critical Requirements

- [ ] **Patient role declared in `meta.roles`** (see next section - THIS IS MANDATORY)
- [ ] At least one learning objective with complete metadata
- [ ] All presenting problem fields completed
- [ ] ICF framework populated (all 5 domains)
- [ ] Red flags ruled out (`red_flags_ruled_out: true`)
- [ ] Evidence-based provenance (CPG, systematic review, or RCT)

---

## Patient Role Declaration (REQUIRED)

### ⚠️ CRITICAL: All Scenarios MUST Include Patient Role

**Every scenario header MUST include a patient role in the `meta.roles` array.**

This is not optional. Add this to your `scenario.header.json`:

```json
{
  "schema_version": "3.0.0",
  "scenario_id": "sc_your_scenario_id_v1",
  "version": 1,
  "status": "draft",
  "meta": {
    "title": "Your Scenario Title",
    "region": "knee",
    "difficulty": "moderate",
    "setting": "outpatient_pt",
    "tags": ["tag1", "tag2"],
    "profession": "physical_therapy",
    "roles": [
      {
        "id": "patient",
        "instruction": null
      }
    ],
    "created_at": "2025-10-23T00:00:00Z",
    "updated_at": "2025-10-23T00:00:00Z"
  }
}
```

### Why `"instruction": null`?

Setting `instruction: null` tells the system to use the **comprehensive built-in patient role directive** (`BUILTIN_ROLE_TEMPLATES.patient`), which includes 17 standard patient behavior rules:

1. **Turn-taking** - Wait for student to speak first, don't interrupt
2. **Identity verification** - Require name + DOB before sharing protected info
3. **Conversational pacing** - Keep responses 1-3 sentences unless asked for detail
4. **Scope boundaries** - Stay within patient knowledge, don't offer clinical advice
5. **Tone and rapport** - Match clinical setting appropriately
6. **Media awareness** - Use `[MEDIA:id]` markers when showing images/videos
7. **Phase respect** - Follow subjective → objective → treatment flow
8. **Gate enforcement** - Respect consent, greeting, and other gates
9. **Realism** - Act as a real patient would, with appropriate limitations
10. **Consistency** - Maintain character throughout the encounter
11. **Safety** - Follow guardrails (e.g., don't perform unsafe tests)
12. **Privacy** - Protect sensitive information appropriately
13. **Emotional authenticity** - Show appropriate concern, frustration, relief
14. **Question answering** - Provide relevant info when asked, don't volunteer excessively
15. **Physical sensations** - Describe what tests feel like from patient perspective
16. **Memory realism** - May not remember exact dates, uses approximations
17. **Cultural sensitivity** - Respect persona's background and communication style

### When to Override (Rarely Needed)

You can provide a custom `instruction` string instead of `null`, but this is rarely necessary. Only override if:

- The scenario requires unique patient behavior not covered by the built-in template
- You need specific behavioral quirks (e.g., patient who avoids eye contact)
- The clinical situation demands a different interaction pattern (e.g., acute trauma patient who's agitated)

**Example of custom instruction (rare):**

```json
{
  "id": "patient",
  "instruction": "You are experiencing acute pain and anxiety. Respond with shorter sentences and show visible discomfort. Ask clarifying questions about the exam before agreeing to tests."
}
```

### Multi-Role Support (Future)

The roles system supports additional roles beyond patient:

```json
"roles": [
  {
    "id": "patient",
    "instruction": null
  },
  {
    "id": "translator",
    "instruction": "You are a medical interpreter. Translate faithfully between Spanish and English. Do not add clinical advice."
  }
]
```

For now, **always include at least the patient role**. Additional roles are optional and can be added later.

---

## Authoring Workflow

### Step 1: Create Scenario Bundle

1. Copy the template folder from `authoring/templates/scenario/`
2. Rename it to your scenario ID (format: `sc_region_condition_v1`)
3. Update all JSON files with your scenario content

### Step 2: Complete scenario.header.json

This is your scenario's metadata file. Required sections:

#### Schema & Status

```json
{
  "schema_version": "3.0.0",
  "scenario_id": "sc_knee_acl_preop_v1",
  "content_version": "1.0.0",
  "version": 1,
  "status": "draft"
}
```

**Status values:** `draft`, `review`, `published`, `archived`

#### Meta Section

```json
{
  "meta": {
    "title": "Direct Access—Suspected ACL Tear (Pre-Op)",
    "region": "knee",
    "difficulty": "moderate",
    "setting": "sports_medicine_outpatient",
    "tags": ["ACL", "prehab", "direct_access", "sports_pt"],
    "profession": "physical_therapy",
    "roles": [
      {
        "id": "patient",
        "instruction": null
      }
    ],
    "created_at": "2025-10-23T00:00:00Z",
    "updated_at": "2025-10-23T00:00:00Z"
  }
}
```

**Valid regions:**
- `hip`, `knee`, `ankle_foot`, `shoulder`, `cervical_spine`, `lumbar_spine`, `thoracic_spine`, `elbow`, `wrist_hand`, `sports_trauma_general`

**Valid difficulties:**
- `easy` - Entry-level DPT students
- `moderate` - Intermediate students or practicing clinicians
- `advanced` - Advanced students or specialty practice

**Valid settings:**
- `outpatient_pt`, `sports_medicine_outpatient`, `acute`, `primary_care_pt`, `telehealth`, `sports_rehab`, `post_op`

#### Pedagogy Section

Define what students should learn:

```json
{
  "pedagogy": {
    "learning_objectives": [
      {
        "id": "lo1",
        "text": "Identify clinical features of ACL rupture and determine appropriate referral while initiating prehab.",
        "bloom_level": "analyze",
        "capte_refs": [
          "safety_screening",
          "plan_of_care",
          "communication_education"
        ],
        "npte_map": {
          "system": "musculoskeletal",
          "domain": "examination",
          "nonsystem": "professional"
        },
        "assessment_focus": [
          "differential_diagnosis",
          "triage"
        ],
        "evidence_req": "CPG|systematic_review"
      }
    ],
    "performance_rubric_ref": "pt_outpatient_core_v1",
    "feedback_bank_keys": [],
    "debrief_prompts": [
      "What tests were unsafe to perform today? Why?"
    ]
  }
}
```

**Bloom levels:** `remember`, `understand`, `apply`, `analyze`, `evaluate`, `create`

**CAPTE standards:** `safety_screening`, `evidence_based_practice`, `communication_education`, `documentation`, `plan_of_care`, `JEDI_belonging_anti_racism`

**NPTE systems:** `musculoskeletal`, `neuromuscular`, `cardiopulmonary`, `integumentary`, `other_systems`

**NPTE domains:** `examination`, `foundations`, `interventions`

**Evidence requirements:** `CPG` (clinical practice guideline), `systematic_review`, `RCT`

#### Presenting Problem

Describe the patient's chief complaint and symptoms:

```json
{
  "presenting_problem": {
    "primary_dx": "Suspected right ACL rupture",
    "onset": "acute",
    "duration_weeks": 0.5,
    "dominant_symptoms": [
      "giving way",
      "swelling",
      "pain with pivoting"
    ],
    "pain_nrs_rest": 2,
    "pain_nrs_activity": 7,
    "aggravators": [
      "weight-bearing pivot",
      "descending stairs"
    ],
    "easers": [
      "rest",
      "ice",
      "compression"
    ],
    "pattern_24h": "Worse later day with activity",
    "red_flags_ruled_out": true
  }
}
```

**Onset values:** `acute`, `gradual`, `insidious`

#### ICF Framework

Use all five ICF domains:

```json
{
  "icf": {
    "health_condition": "acute knee ligament injury",
    "body_functions_structures": [
      "effusion",
      "loss of extension",
      "quad inhibition"
    ],
    "activities": [
      "ambulation with antalgia",
      "stairs",
      "squatting limited"
    ],
    "participation": [
      "sport participation limited"
    ],
    "environmental_factors": [
      "brace available"
    ],
    "personal_factors": [
      "competitive athlete",
      "high motivation"
    ]
  }
}
```

#### Provenance

Document evidence sources:

```json
{
  "provenance": {
    "sources": [
      {
        "title": "2019 CPG: ACL Injury Management",
        "identifier": "DOI:10.2519/jospt.2019.0302",
        "level_of_evidence": "CPG"
      }
    ],
    "reviewers": ["faculty_reviewer"],
    "last_reviewed": "2025-10-23"
  }
}
```

#### Guardrails (Optional)

Age/sex filtering for persona matching:

```json
{
  "guardrails": {
    "min_age": 15,
    "max_age": 40,
    "sex_required": null,
    "strict": true
  }
}
```

**Set `strict: true`** to enforce hard limits. Set `false` for soft recommendations.

### Step 3: Complete SOAP Files

#### soap.subjective.json

Patient history and responses:

```json
{
  "history": {
    "chief_complaint": "My knee gives way and it's really swollen",
    "mechanism": "Pivoted during basketball and heard a pop",
    "prior_episodes": "Never had this before",
    "functional_impact": "Can't play basketball, stairs are hard"
  },
  "subjective_catalog": [
    {
      "id": "imaging_xray",
      "label": "Imaging (X-ray)",
      "patterns": ["imaging", "x-ray", "xray", "radiograph"],
      "patient_response_script": {
        "qualitative": [
          "I got X-rays at urgent care. They said no bones were broken."
        ]
      },
      "notes": "Patient has X-rays on patient portal. MUST include [MEDIA:knee_xray] marker when offering to show."
    }
  ],
  "media_library": [
    {
      "id": "knee_xray",
      "type": "image",
      "url": "/media/scenarios/acl/knee-x-ray.jpg",
      "caption": "Bilateral knee X-ray showing no bony abnormalities",
      "clinical_context": ["imaging", "xray", "radiograph"],
      "trigger_patterns": ["xray", "x-ray", "show me imaging"]
    }
  ]
}
```

**Media markers:** When patient mentions media, include `[MEDIA:id]` in the response. The AI will use this to trigger showing images/videos.

#### soap.objective.json

Physical exam findings:

```json
{
  "objective_catalog": [
    {
      "test_id": "lachman",
      "label": "Lachman Test",
      "template": "knee_ligament_laxity",
      "findings": {
        "grade": "2+",
        "endpoint": "soft",
        "comparison": "significant difference from unaffected side"
      },
      "difficulty": "moderate"
    }
  ],
  "contraindications_precautions": [
    "Avoid high-impact testing (hop tests) due to acute injury and instability"
  ]
}
```

**Test difficulty:** `easy`, `moderate`, `hard` - affects student rubric scoring

#### soap.assessment.json

Clinical reasoning:

```json
{
  "primary_diagnosis": "Suspected complete ACL tear",
  "differential_diagnoses": [
    "ACL tear with possible meniscal involvement",
    "Isolated meniscal tear",
    "MCL sprain"
  ],
  "clinical_reasoning": [
    "Acute traumatic onset with audible pop",
    "Positive Lachman with soft endpoint",
    "Effusion and functional instability"
  ],
  "prognosis": "Good with surgical reconstruction and appropriate rehabilitation"
}
```

#### soap.plan.json

Treatment recommendations:

```json
{
  "goals": [
    {
      "timeframe": "1 week",
      "goal": "Reduce effusion to trace/mild",
      "measurable": true
    },
    {
      "timeframe": "2 weeks",
      "goal": "Achieve full passive extension",
      "measurable": true
    }
  ],
  "interventions": [
    {
      "category": "therapeutic_exercise",
      "name": "Quadriceps sets",
      "dosage": "3 sets of 20, 5-second holds, 2x daily"
    }
  ],
  "education": [
    "RICE protocol",
    "Quad activation importance for pre-hab",
    "Timeline for orthopedic consultation"
  ]
}
```

### Step 4: Compile & Validate

After completing all files:

```bash
# Navigate to backend
cd backend

# Compile your scenario
npm run sps:compile --scenario=sc_your_scenario_id_v1

# Validate the output
npm run sps:validate-compiled

# Generate manifests
npm run sps:generate-manifests
```

If compilation succeeds, you'll see a compiled file at:
`backend/src/sps/content/scenarios/compiled/sc_your_scenario_id_v1.json`

---

## Metadata Requirements

### Complete Header Example

Here's a fully populated header showing all required fields:

```json
{
  "schema_version": "3.0.0",
  "scenario_id": "sc_knee_anterior_knee_pain_entry_v1",
  "content_version": "1.0.0",
  "version": 1,
  "status": "draft",
  "meta": {
    "title": "Entry-Level: Anterior Knee Pain with Stairs",
    "region": "knee",
    "difficulty": "easy",
    "setting": "outpatient_pt",
    "tags": ["entry_level_dpt", "anterior_knee_pain", "patellofemoral"],
    "profession": "physical_therapy",
    "roles": [
      {
        "id": "patient",
        "instruction": null
      }
    ],
    "created_at": "2025-10-23T00:00:00Z",
    "updated_at": "2025-10-23T00:00:00Z"
  },
  "linkage": {
    "persona_id": "",
    "instructions_file": "./instructions.json",
    "soap_subjective_file": "./soap.subjective.json",
    "soap_objective_file": "./soap.objective.json",
    "soap_assessment_file": "./soap.assessment.json",
    "soap_plan_file": "./soap.plan.json",
    "active_context_modules": []
  },
  "pedagogy": {
    "learning_objectives": [
      {
        "id": "LO1",
        "text": "Apply region-specific tests to characterize anterior knee pain",
        "bloom_level": "apply",
        "capte_refs": ["safety_screening", "evidence_based_practice"],
        "npte_map": {
          "system": "musculoskeletal",
          "domain": "examination",
          "nonsystem": "safety"
        },
        "assessment_focus": ["clinical_reasoning", "safety"],
        "evidence_req": "CPG"
      }
    ],
    "performance_rubric_ref": "pt_outpatient_core_v1",
    "feedback_bank_keys": [],
    "debrief_prompts": [
      "Which findings supported a patellofemoral source vs. tendinopathy?"
    ]
  },
  "presenting_problem": {
    "primary_dx": "Anterior knee pain (patellofemoral pain syndrome)",
    "onset": "gradual",
    "duration_weeks": 6,
    "dominant_symptoms": ["anterior knee ache", "pain with stairs"],
    "pain_nrs_rest": 1,
    "pain_nrs_activity": 5,
    "aggravators": ["descending stairs", "prolonged sitting"],
    "easers": ["rest", "ice"],
    "pattern_24h": "stiff morning that eases, aches later after activity",
    "red_flags_ruled_out": true
  },
  "icf": {
    "health_condition": "PFPS limiting stair and squat tolerance",
    "body_functions_structures": ["patellar tendon tenderness"],
    "activities": ["descending stairs limited", "squatting limited"],
    "participation": ["reduced recreational activity"],
    "environmental_factors": ["office work with prolonged sitting"],
    "personal_factors": ["increased recent training volume"]
  },
  "provenance": {
    "sources": [
      {
        "title": "2019 CPG: Patellofemoral Pain",
        "identifier": "CPG-2019-PFPS",
        "level_of_evidence": "CPG"
      }
    ],
    "reviewers": ["faculty_reviewer"],
    "last_reviewed": "2025-10-23"
  }
}
```

---

## Content Quality Guidelines

### Subjective Content

**DO:**
- Include prepared responses for common questions (medications, imaging, prior PT, etc.)
- Use `[MEDIA:id]` markers when patient mentions showing something
- Make responses consistent with persona demographics and presentation
- Keep responses realistic (1-3 sentences unless detail requested)

**DON'T:**
- Volunteer excessive information unprompted
- Include clinical jargon the patient wouldn't know
- Create contradictions between subjective and objective findings
- Forget to link media in both `subjective_catalog` and `media_library`

### Objective Content

**DO:**
- Provide findings for all common tests in the region
- Set appropriate difficulty levels (easy/moderate/hard)
- Include contraindications/precautions when relevant
- Make findings consistent with the diagnosis

**DON'T:**
- Make every test unsafe (be selective with guardrails)
- Use unrealistic findings
- Forget bilateral comparisons where appropriate
- Include findings that contradict the subjective history

### Assessment & Plan

**DO:**
- Include differential diagnoses (not just the primary diagnosis)
- Provide clinical reasoning that ties together subjective and objective
- Use SMART goals (Specific, Measurable, Achievable, Relevant, Time-bound)
- Base interventions on evidence (CPG, systematic reviews)

**DON'T:**
- Jump to conclusions without supporting evidence
- Ignore red flags or safety concerns
- Create unrealistic treatment timelines
- Forget patient education components

---

## Compilation & Validation

### Compilation Process

The compilation process takes your bundle files and creates a single optimized JSON file:

```bash
# Compile single scenario
npm run sps:compile --scenario=sc_your_scenario_id_v1

# Compile all scenarios
npm run sps:compile --all

# Force recompilation (ignore cache)
npm run sps:compile --scenario=sc_your_scenario_id_v1 --force
```

**What happens during compilation:**
1. Reads all bundle files from `bundles_src/<scenario_id>/`
2. Validates JSON syntax and required fields
3. Resolves persona and module references
4. Generates checksums for version control
5. Outputs compiled file to `scenarios/compiled/<scenario_id>.json`
6. Updates the scenario index

### Validation

```bash
# Validate compiled scenarios
npm run sps:validate-compiled

# Validate kits (persona-scenario mapping)
npm run sps:kits:validate

# Validate all content
npm run sps:validate:content
```

**Validation checks:**
- All required fields present
- References to personas/modules exist
- JSON structure matches schema
- Learning objectives have required metadata
- ICF framework is complete
- Evidence sources are documented

### Manifest Generation

After making changes, regenerate manifests:

```bash
npm run sps:generate-manifests
```

**This creates:**
- `content/manifest.json` - Version info for all content
- `content/dependencies.json` - Scenario dependency graph
- `content/catalogs/report.json` - Catalog usage analysis

---

## Common Mistakes to Avoid

### 1. Forgetting Patient Role ⚠️

**WRONG:**
```json
{
  "meta": {
    "title": "My Scenario",
    "region": "knee",
    "difficulty": "moderate"
  }
}
```

**CORRECT:**
```json
{
  "meta": {
    "title": "My Scenario",
    "region": "knee",
    "difficulty": "moderate",
    "roles": [
      {
        "id": "patient",
        "instruction": null
      }
    ]
  }
}
```

### 2. Inconsistent Pain Ratings

**WRONG:** Pain at rest = 7, pain with activity = 5

**CORRECT:** Pain at rest = 2, pain with activity = 7

Pain should generally be worse with activity unless this is a special case (e.g., inflammatory condition worse at rest).

### 3. Missing Media Markers

**WRONG:**
```json
"patient_response_script": {
  "qualitative": ["I have X-rays from the ER"]
}
```

**CORRECT:**
```json
"patient_response_script": {
  "qualitative": ["I have X-rays from the ER. [MEDIA:knee_xray] Here, let me show you."]
}
```

### 4. Unrealistic Guardrails

**WRONG:** Making every test unsafe
```json
"contraindications_precautions": [
  "No ROM testing",
  "No strength testing",
  "No special tests",
  "No functional testing"
]
```

**CORRECT:** Being selective
```json
"contraindications_precautions": [
  "Avoid high-impact testing (hop tests) due to acute injury and instability"
]
```

### 5. Vague Learning Objectives

**WRONG:**
```json
{
  "text": "Understand knee pain",
  "bloom_level": "understand"
}
```

**CORRECT:**
```json
{
  "text": "Differentiate patellofemoral pain from patellar tendinopathy using clinical examination findings and patient history",
  "bloom_level": "analyze"
}
```

### 6. Missing Evidence Requirements

**WRONG:**
```json
{
  "evidence_req": ""
}
```

**CORRECT:**
```json
{
  "evidence_req": "CPG|systematic_review"
}
```

### 7. Incomplete ICF

**WRONG:** Only filling in some domains
```json
{
  "icf": {
    "health_condition": "knee pain",
    "body_functions_structures": ["pain"]
  }
}
```

**CORRECT:** All five domains
```json
{
  "icf": {
    "health_condition": "patellofemoral pain syndrome",
    "body_functions_structures": ["anterior knee pain", "quad weakness"],
    "activities": ["stair descent limited", "prolonged sitting painful"],
    "participation": ["reduced recreational running"],
    "environmental_factors": ["office job with prolonged sitting"],
    "personal_factors": ["recently increased running volume"]
  }
}
```

### 8. Timeline Mismatches

Make sure onset, duration, and history align:

**WRONG:**
```json
{
  "onset": "acute",
  "duration_weeks": 52,
  "history": "Started suddenly yesterday"
}
```

**CORRECT:**
```json
{
  "onset": "acute",
  "duration_weeks": 0.14,
  "history": "Started suddenly yesterday after basketball"
}
```

---

## AI-Assisted Authoring

You can use AI tools like ChatGPT or Claude to help generate scenario content.

### Recommended Prompts

**For generating a scenario outline:**
```
I need to create a PT case scenario for [condition]. The patient is a [age] year old [demographics] presenting with [chief complaint]. Generate a scenario header with:
- Learning objectives (2-3, with Bloom levels)
- Presenting problem details
- ICF framework (all 5 domains)
- Provenance (cite relevant CPGs)

Make it appropriate for [entry/intermediate/advanced] level students.
```

**For creating subjective content:**
```
Create patient responses for a [age] year old with [condition]. Include:
- Chief complaint (in patient's words)
- Mechanism of injury
- Aggravating/easing factors
- Functional limitations
- Prior treatments

Keep responses realistic and concise (1-3 sentences per topic).
```

**For objective findings:**
```
Generate objective findings for [condition] in the [region]. Include:
- Special tests with expected results
- ROM measurements
- Strength findings
- Palpation findings
- Functional tests

Mark which tests might be contraindicated given [presentation details].
```

### Using the LLM Case Generation Kit

For detailed prompts and templates, see: **[LLM_CASE_GENERATION_PROMPT_KIT.md](LLM_CASE_GENERATION_PROMPT_KIT.md)**

This includes plug-and-play prompts for:
- Entry-level DPT cases
- Intermediate/advanced cases
- Evidence-based rationales
- Rubric alignment

---

## Troubleshooting

### Compilation Errors

**Error: "Cannot find module"**
- Check that all file paths in `linkage` section are correct
- Ensure files exist with exact names (case-sensitive)

**Error: "Invalid JSON"**
- Run your JSON through a validator (jsonlint.com)
- Check for missing commas, brackets, quotes
- Ensure all strings use double quotes, not single

**Error: "Missing required field"**
- Check the template for all required fields
- Ensure `meta.roles` array exists with patient role
- Verify all learning objectives have required metadata

### Validation Errors

**Error: "Persona not found"**
- Check `linkage.persona_id` matches an existing persona
- Leave empty (`""`) if using runtime persona selection

**Error: "Module not found"**
- Verify module IDs in `active_context_modules` exist
- Check module version numbers are correct

**Error: "Invalid region"**
- Use only valid region values (see metadata section)
- Check spelling and case (all lowercase, underscores)

### Runtime Errors

If your scenario doesn't appear in the app:

1. **Rebuild backend:**
   ```bash
   cd backend
   npm run build
   ```

2. **Restart server:**
   ```bash
   npm run dev
   ```

3. **Check logs:**
   Look for errors in the terminal where backend is running

4. **Verify compilation:**
   ```bash
   ls src/sps/content/scenarios/compiled/
   ```
   Your scenario should be listed

### Getting Help

If you encounter issues:

1. Check this guide's troubleshooting section
2. Review example scenarios in `bundles_src/`
3. Check compilation logs for specific error messages
4. Contact the development team with:
   - Scenario ID
   - Error message
   - Compilation output
   - Relevant JSON snippets

---

## Version Control

### Versioning Your Scenarios

Each scenario has two version numbers:

1. **`version`** - Incremental integer (1, 2, 3, etc.)
2. **`content_version`** - Semantic version (1.0.0, 1.1.0, 2.0.0)

**When to bump versions:**

- **Major (2.0.0)** - Breaking changes, different clinical presentation
- **Minor (1.1.0)** - New content, additional learning objectives
- **Patch (1.0.1)** - Bug fixes, typo corrections, clarifications

### Change Notes

Document your changes:

```json
{
  "content_version": "1.1.0",
  "change_notes": [
    "v1.1.0: Added media library with X-ray images",
    "v1.0.1: Fixed typo in assessment",
    "v1.0.0: Initial version"
  ]
}
```

### Bumping Versions (Future)

A version bumping tool is planned:

```bash
npm run sps:bump-version -- \
  --type=scenario \
  --id=sc_your_scenario_v1 \
  --bump=minor \
  --note="Added translator role support"
```

For now, update versions manually and document in `change_notes`.

---

## Quick Reference

### Essential Commands

```bash
# Compile scenario
npm run sps:compile --scenario=<scenario_id>

# Validate
npm run sps:validate-compiled

# Generate manifests
npm run sps:generate-manifests

# Full workflow
npm run sps:compile --scenario=<scenario_id> && \
npm run sps:validate-compiled && \
npm run sps:generate-manifests
```

### File Templates

All templates are in: `backend/src/sps/authoring/templates/`

- `scenario/scenario.header.template.json`
- `soap/soap.subjective.template.json`
- `soap/soap.objective.template.json`
- `soap/soap.assessment.template.json`
- `soap/soap.plan.template.json`
- `instructions.template.json`

### Example Scenarios

Study these examples:

- **Entry level:** `sc_knee_anterior_knee_pain_entry_v1`
- **Moderate:** `sc_knee_anterior_knee_pain_intermediate_v1`
- **Advanced:** `sc_knee_acl_preop_direct_access_v1`
- **Acute care:** `sc_hip_tha_anterior_pod0_v1`

---

## Additional Resources

### Documentation

- **[SPS_ROLES_EXTENSIBILITY.md](../../SPS_ROLES_EXTENSIBILITY.md)** - Multi-role system details
- **[SPS_KITS_AND_AUDIENCE_GUIDE.md](../../SPS_KITS_AND_AUDIENCE_GUIDE.md)** - Persona-scenario mapping
- **[LLM_CASE_GENERATION_PROMPT_KIT.md](LLM_CASE_GENERATION_PROMPT_KIT.md)** - AI prompts for case generation

### Clinical Guidelines

- APTA Clinical Practice Guidelines: https://www.apta.org/patient-care/evidence-based-practice-resources/cpgs
- JOSPT Clinical Practice Guidelines: https://www.jospt.org/
- Cochrane Reviews: https://www.cochrane.org/

### Evidence Databases

- PubMed: https://pubmed.ncbi.nlm.nih.gov/
- PEDro: https://www.pedro.org.au/
- APTA Open Door: https://www.apta.org/

---

## Contact & Support

For questions or issues:

1. Review this guide thoroughly
2. Check example scenarios
3. Try the troubleshooting section
4. Contact development team with specific details

**Last Updated:** October 23, 2025  
**Document Version:** 1.0.0
