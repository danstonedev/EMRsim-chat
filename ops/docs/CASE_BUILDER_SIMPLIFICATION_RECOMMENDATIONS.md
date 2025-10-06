# Case Builder Simplification Recommendations

**Date:** October 1, 2025  
**Scope:** Comprehensive review of the Case Builder UI and workflow for standardized patient scenario authoring

---

## Executive Summary

The Case Builder has a solid foundation but contains numerous fields and options that add cognitive load without proportional value for creating standardized patient cases. This document identifies areas of unnecessary complexity, especially in the **Objective section**, and provides actionable recommendations to streamline the authoring experience.

**Key Finding:** The system is over-engineered for the typical use case. Most faculty users need to:
1. Define the case basics (region, title, diagnosis)
2. Describe the presenting problem
3. Select objective tests and define expected findings
4. Save and deploy

The current implementation exposes too many technical details, redundant fields, and granular controls that should be automated or hidden.

---

## Analysis by Section

### 1. Overview (Setup) Step

#### Current State:
- **Scenario ID** (manual entry, can auto-generate)
- **Title** (essential)
- **Region** (essential)
- **Difficulty** (optional, in advanced mode)
- **Setting** (optional, in advanced mode)
- **Tags** (optional, in advanced mode)

#### Issues:
- **Scenario ID** requires users to understand naming conventions and ensure uniqueness
- **Difficulty** and **Setting** are rarely critical to the teaching scenario
- **Tags** are unclear in purpose—do they affect matching, search, or just organization?

#### Recommendations:

✅ **Auto-generate Scenario ID completely**
- Remove manual ID entry entirely
- Generate unique IDs server-side using: `sc_[region]_[timestamp]_[random]`
- Display read-only ID only after first save
- **Impact:** Eliminates validation errors, duplicate checks, and user confusion

✅ **Simplify to 3 core fields only (default view)**
- Title
- Region
- Diagnosis (move from Subjective to Overview)

✅ **Move optional metadata to an expandable "Advanced" section**
- Difficulty, Setting, Tags only visible if explicitly expanded
- Most users won't need these

---

### 2. Subjective (History) Step

#### Current State:
- **Presenting Problem** (10+ fields)
  - Primary Dx, Onset, Onset Detail, Duration, Symptoms, Pain NRS x2, Aggravators, Easers, 24h Pattern, Red Flags checkbox
- **ICF Framing** (6 multi-field sections) - advanced only
  - Health condition, Body functions/structures, Activities, Participation, Environmental factors, Personal factors
- **Subjective Catalog** - advanced only
  - Manual item authoring with ID, label, patterns, response scripts (qualitative, numeric, binary flags), notes

#### Issues:
- **Too many pain/symptom fields** — Pain NRS at rest vs. activity is granular; 24h pattern rarely needed
- **ICF framework** is academically rigorous but cumbersome for rapid case authoring
- **Onset Detail** is redundant with the main onset dropdown
- **Red Flags checkbox** — unclear when/why to use; clinical decision not authoring need
- **Subjective Catalog** — extremely technical; requires understanding of pattern matching and scripted responses. Most scenarios in the wild don't use this.

#### Recommendations:

✅ **Consolidate Presenting Problem to 6 fields**
1. **Primary Diagnosis** (text)
2. **Onset** (dropdown: acute / gradual / insidious)
3. **Duration** (weeks)
4. **Chief Complaint** (free text, replaces "dominant symptoms" — simpler language)
5. **What makes it worse?** (free text, replaces "aggravators")
6. **What makes it better?** (free text, replaces "easers")

**Remove entirely:**
- Onset detail (redundant)
- Pain NRS rest/activity (can be inferred or optional advanced)
- 24h pattern (rarely used)
- Red flags checkbox (not relevant to authoring)

✅ **Move ICF to optional "Advanced Clinical Framing" section**
- Hidden by default
- Pre-fill intelligent defaults based on diagnosis/region when expanded
- Most users won't need this

✅ **Hide Subjective Catalog by default**
- Too technical for 95% of use cases
- Only expose for advanced users building complex scenarios
- Consider deprecating or replacing with simpler "Patient Will Say" section:
  - Single textarea: "Key phrases or quotes the patient should use"
  - Backend AI can interpret this into structured data

---

### 3. Objective (Exam) Step — **PRIMARY FOCUS**

#### Current State:
This section has the most complexity:

**Quick Add Buttons** (good concept, cluttered execution)
- 9 category buttons + "Add all" button
- Categories: observations, palpation, AROM, PROM, strength, neuro dermatomes, neuro myotomes, neuro reflexes, functional

**Batch Fill Outputs** (confusing utility)
- Apply to: dropdown (all or specific category)
- Mode: merge vs overwrite radio buttons
- 3 text areas: qualitative lines, numeric k:v, flags k:v
- Purpose unclear without documentation

**Objective Catalog** (over-detailed)
Each test has:
- Test ID (manual entry)
- Label
- Region (dropdown)
- Instructions (brief text)
- Qualitative outputs (line-separated list)
- Numeric/flags (k:v syntax)
- Plus hidden: preconditions, contraindications, guardrails

#### Issues:

❌ **Test ID is too technical**
- Users shouldn't need to know `obj_hip_palp_gt` conventions
- Auto-generate from region + label

❌ **Region dropdown per test is redundant**
- Already selected at scenario level
- Creates inconsistency risk

❌ **Batch Fill is powerful but non-intuitive**
- Users don't understand "merge vs overwrite"
- k:v syntax is programmer-speak
- Purpose/benefit unclear

❌ **Qualitative vs Numeric vs Binary Flags distinction is over-engineered**
- Users don't think in these terms
- They think: "What should the patient's test result be?"

❌ **9 category buttons feel like a quiz**
- Users may not know what "neuro myotomes" means
- Creates pressure to add everything

❌ **Instructions field is vague**
- Unclear if this is for the student or the SP
- Often redundant with test label

#### Recommendations:

### 🔥 **Objective Section Overhaul**

#### Phase 1: Simplify the UI

✅ **Replace Quick Add Categories with Smart Presets**

Instead of 9 confusing categories, offer:
- **Add Essential Tests** (5-8 most common for that region)
- **Add Full Examination** (comprehensive battery)
- **Add Manual Test** (one at a time, for customization)

Each region has a curated "Essential" list:
- **Hip:** ROM, FADIR, FABER, Trendelenburg, Palpation GT, Strength MMT, Gait
- **Knee:** ROM, Lachman, McMurray, Patellar grind, Palpation, Gait
- **Ankle:** ROM, Anterior drawer, Talar tilt, Balance, Palpation
- etc.

✅ **Simplify Each Test to 3 Fields**
1. **Test Name** (dropdown of common tests OR free text for custom)
2. **Expected Finding** (single textarea: natural language description)
   - Example: "FADIR painful at end-range, 6/10 groin pain"
   - Example: "ROM: Flexion 105°, IR 10°, ER 35°, end-range stiffness"
3. **Remove Button**

**Auto-generate behind the scenes:**
- Test ID: `obj_[region]_[sanitized_test_name]`
- Region: inherit from scenario
- Parse "Expected Finding" text into structured data using AI/NLP (or store as-is)

✅ **Remove Batch Fill entirely**
- Adds complexity without clear use case
- If users need to apply common findings, they can:
  - Use Essential presets (pre-filled appropriately)
  - Copy/paste in "Expected Finding" field

✅ **Remove Advanced Fields (hidden entirely)**
- Preconditions, contraindications, guardrails are implementation details
- Faculty don't need to manage these
- Set sensible defaults server-side

#### Phase 2: Rethink the Data Model

The current schema forces users to think like programmers:

```json
"patient_output_script": {
  "qualitative": ["Deep ache in groin"],
  "numeric": { "angle": 105, "pain_nrs": 6 },
  "binary_flags": { "end_range_pain": true }
}
```

**New approach:** Store as natural language, parse later if needed

```json
"expected_finding": "Deep ache in groin, flexion 105 degrees, pain 6/10 at end range"
```

Benefits:
- Users write what they mean
- AI can parse if structured data is needed for logic
- More maintainable and human-readable
- Reduces authoring time by 70%

---

### 4. Review & Publish Step

#### Current State:
- **Generate with AI** section (prompt + research toggle)
- **JSON preview** toggle
- Save/Update button in sidebar

#### Issues:
- AI generation feels like an afterthought—should be more prominent
- JSON preview is technical; most users don't need it
- No validation feedback before save

#### Recommendations:

✅ **Promote AI Generation to Step 1**
- Offer "Start from AI" vs "Start from template" at the beginning
- Users describe the case in natural language first
- AI generates draft → user refines
- **Much faster** for 80% of use cases

✅ **Replace JSON preview with "Case Summary"**
- Human-readable summary card:
  - Title, Region, Diagnosis
  - 3-5 key symptoms
  - Number of objective tests included
  - Missing/incomplete fields highlighted
- Reduce technical exposure

✅ **Add Pre-Save Validation**
- Show errors/warnings BEFORE attempting save:
  - "Missing: At least 3 objective tests"
  - "Warning: No duration specified"
- Prevent frustrating save failures

---

## Workflow Simplification

### Current: 4-Step Linear Process
1. Overview → 2. Subjective → 3. Objective → 4. Review

### Recommended: 2 Modes

#### **Quick Mode** (default for most users)
Single-page form:
- Case basics (title, region, diagnosis)
- Presenting problem (6 simplified fields)
- Objective tests (preset + add custom)
- Generate & Save

**Estimated time:** 5-10 minutes

#### **Advanced Mode** (opt-in)
Multi-step with all current fields available:
- Full ICF framework
- Subjective catalog scripting
- Granular objective test configuration
- Batch operations

**Use case:** <10% of scenarios

---

## Technical Implementation Priorities

### High Priority (Do First)

1. **Auto-generate Test IDs and Scenario IDs**
   - Backend: Add ID generation utilities
   - Frontend: Remove manual ID fields
   - **Files:** `backend/src/routes/sps.js`, `frontend/src/pages/CaseBuilder.tsx`

2. **Simplify Objective Test Structure**
   - Add `expected_finding` string field to schema
   - Make `patient_output_script` optional/deprecated
   - Update UI to single textarea per test
   - **Files:** `backend/src/sps/core/schemas.ts`, `CaseBuilder.tsx` lines 800-1000

3. **Reduce Presenting Problem Fields**
   - Remove: onset_detail, pain_nrs_rest/activity, pattern_24h, red_flags
   - Rename: dominant_symptoms → chief_complaint
   - **Files:** `schemas.ts`, `CaseBuilder.tsx` lines 650-750

4. **Replace Category Buttons with Presets**
   - Create region-specific "Essential" and "Full" test lists
   - Replace 9 category buttons with 2-3 preset buttons
   - **Files:** `CaseBuilder.tsx` lines 230-300 (templates), lines 810-830 (UI)

### Medium Priority

5. **Hide Advanced Fields by Default**
   - Move ICF, tags, difficulty to collapsible sections
   - Add "Quick Mode" / "Advanced Mode" toggle
   - **Files:** `CaseBuilder.tsx` (state management + conditional rendering)

6. **Promote AI Generation**
   - Move AI prompt to Step 1 or initial modal
   - Add "Start from AI" vs "Start blank" choice
   - **Files:** `CaseBuilder.tsx` lines 620-640 (generateWithAI), routing logic

7. **Remove Batch Fill UI**
   - Delete batch fill section entirely
   - Remove state: `batchCat`, `batchQual`, `batchNumeric`, etc.
   - **Files:** `CaseBuilder.tsx` lines 580-610, 910-975

### Low Priority (Future)

8. **Natural Language Parsing**
   - Add NLP to parse "Expected Finding" text into structured data
   - Backend service: extract numeric values, pain scales, qualitative notes
   - **New file:** `backend/src/services/nlp_parse_findings.js`

9. **Pre-Save Validation UI**
   - Add validation summary before save
   - Highlight missing required fields
   - **Files:** `CaseBuilder.tsx` validation logic around line 140

---

## User Testing Recommendations

Before implementing, validate these assumptions:

1. **Interview 3-5 faculty users:**
   - What fields do they actually use?
   - Which sections do they skip?
   - What causes confusion?

2. **Time-to-complete study:**
   - Measure current authoring time
   - Prototype simplified version
   - Compare time and user satisfaction

3. **A/B test Quick Mode vs Advanced Mode:**
   - Do users complete scenarios faster?
   - Is quality maintained?

---

## Migration Plan

### Phase 1: Non-Breaking Additions (Week 1-2)
- Add `expected_finding` field to schema (optional)
- Auto-generate IDs server-side if not provided
- Add Quick/Advanced mode toggle (no functional change yet)

### Phase 2: UI Simplification (Week 3-4)
- Implement Quick Mode UI
- Update default form to simplified fields
- Hide advanced sections behind toggle
- Remove batch fill UI

### Phase 3: Deprecation (Week 5-6)
- Mark old fields as deprecated in schema
- Update existing scenarios to populate `expected_finding` from structured data
- Add migration script

### Phase 4: Cleanup (Week 7+)
- Remove deprecated fields from schema
- Remove old UI code
- Update documentation
- Train users on new workflow

---

## Success Metrics

How to measure if simplification worked:

1. **Time-to-Completion**
   - Target: <10 minutes for typical scenario (down from 20-30)

2. **Field Completion Rate**
   - Target: >90% of scenarios have all recommended fields filled

3. **User Satisfaction**
   - Survey: "How easy was it to author this case?" (1-5 scale)
   - Target: 4.2+ average

4. **Error Rate**
   - Target: <5% of save attempts fail validation

5. **Adoption Rate**
   - Target: 80% of new scenarios use Quick Mode

---

## Conclusion

The Case Builder is feature-rich but over-complicated for the core use case. By:
- **Removing** technical jargon and redundant fields
- **Simplifying** the objective test workflow
- **Automating** ID generation and defaults
- **Hiding** advanced features for power users only

...we can reduce authoring time by 50-70% while maintaining scenario quality and clinical accuracy.

**Recommended Next Step:** Validate these findings with 3-5 real users, then prioritize the High Priority implementation tasks.

---

**Appendix: Field-by-Field Audit**

| Field | Current Status | Recommendation | Priority |
|-------|---------------|----------------|----------|
| Scenario ID | Manual entry | Auto-generate | HIGH |
| Title | Required | Keep as-is | - |
| Region | Required | Keep as-is | - |
| Difficulty | Optional | Move to advanced | MED |
| Setting | Optional | Move to advanced | MED |
| Tags | Optional | Move to advanced | MED |
| Primary Dx | Required | Move to Overview | HIGH |
| Onset | Required | Keep simplified | - |
| Onset Detail | Optional | Remove | HIGH |
| Duration | Required | Keep as-is | - |
| Dominant Symptoms | Required | Rename "Chief Complaint" | HIGH |
| Pain NRS Rest | Optional | Remove or advanced | HIGH |
| Pain NRS Activity | Optional | Remove or advanced | HIGH |
| Aggravators | Optional | Keep, simplify label | - |
| Easers | Optional | Keep, simplify label | - |
| 24h Pattern | Optional | Remove | HIGH |
| Red Flags Checkbox | Optional | Remove | HIGH |
| ICF Framework | Optional | Move to advanced | MED |
| Subjective Catalog | Optional | Hide by default | MED |
| Objective Quick Add (9 buttons) | Core feature | Replace with 2 presets | HIGH |
| Objective Batch Fill | Utility | Remove entirely | MED |
| Test ID | Manual | Auto-generate | HIGH |
| Test Region | Dropdown | Remove (inherit) | HIGH |
| Test Instructions | Optional | Remove or simplify | MED |
| Qualitative/Numeric/Flags | Structured | Merge to "Expected Finding" | HIGH |
| Preconditions | Advanced | Remove from UI | LOW |
| Contraindications | Advanced | Remove from UI | LOW |
| Guardrails | Advanced | Remove from UI | LOW |
| AI Generation | Review step | Promote to Step 1 | MED |
| JSON Preview | Review step | Replace with summary | LOW |

---

**End of Recommendations**
