# Scenario Authoring Simplification Roadmap

**Status:** In Progress  
**Last Updated:** October 23, 2025  
**Goal:** Reduce scenario authoring time from 20-30 minutes to <10 minutes

---

## Current Pain Points

### ❌ Problem 1: Too Many Files to Manage
**Impact:** High cognitive load, easy to miss files  
**Current State:** Authors must create and maintain **6+ separate JSON files** per scenario:
- `scenario.header.json` - Metadata, pedagogy, roles
- `instructions.json` - AI instructions
- `soap.subjective.json` - Patient history
- `soap.objective.json` - Physical exam findings
- `soap.assessment.json` - Clinical reasoning
- `soap.plan.json` - Treatment plan
- Optional: module config files (e.g., `sports.module.json`)

**User Quote:** "I never know which file to put things in. Is 'patient goals' in subjective or plan?"

---

### ❌ Problem 2: Manual Multi-Step Build Process
**Impact:** Frustrating workflow, easy to forget steps  
**Current State:** After creating/editing scenarios, authors must remember to:
```bash
npm run sps:compile --scenario=<id>  # Compile to single file
npm run sps:validate-compiled         # Check for errors
npm run sps:generate-manifests        # Update dependency tracking
npm run build                         # Rebuild backend
# Manually restart backend server
```

**User Quote:** "I edited my scenario but it's not showing up in the app. Did I forget a step?"

---

### ❌ Problem 3: No Compilation Script in package.json
**Impact:** Authors don't know how to compile  
**Current State:** The `npm run build` only copies content, doesn't compile scenarios. The compile script exists but isn't exposed as an npm command.

**Files Affected:**
- `backend/package.json` - Missing `sps:compile` command
- `backend/src/sps/tools/compile-content.ts` - Exists but not runnable

---

### ❌ Problem 4: Complex Schema Requirements
**Impact:** Steep learning curve, errors, incomplete scenarios  
**Current State:** Authors must understand:
- Exact JSON schema structure (no validation until compile)
- Patient role declaration in `meta.roles` (easy to forget)
- ICF framework (all 5 domains required)
- CAPTE standards mapping (cryptic codes)
- NPTE domain mapping (system/domain/nonsystem)
- Evidence requirement levels (CPG vs systematic_review vs RCT)
- Bloom's taxonomy levels
- Test ID naming conventions

**User Quote:** "I just want to make a simple knee pain case, why do I need to know CAPTE standards?"

---

### ❌ Problem 5: No Starter Templates or Wizards
**Impact:** Authors start from scratch or copy-paste, introducing errors  
**Current State:** Authors must:
- Find an existing scenario to copy
- Manually change all IDs and fields
- Hope they didn't miss required fields
- Discover missing fields only at compile time

---

### ❌ Problem 6: Test Findings Are Over-Structured
**Impact:** Authors think like programmers, not clinicians  
**Current State:** Objective findings require structured data:
```json
"patient_output_script": {
  "qualitative": ["Deep ache in groin"],
  "numeric": { "angle": 105, "pain_nrs": 6 },
  "binary_flags": { "end_range_pain": true }
}
```

**User Quote:** "I just want to say 'Hip flexion is 105 degrees with pain at end range.' Why the complex structure?"

---

## Solutions Roadmap

### ✅ **Phase 0: Documentation & Quick Wins** (COMPLETED)
**Timeline:** October 23, 2025  
**Status:** ✅ Done

- [x] Create comprehensive authoring guide (`SCENARIO_AUTHORING_GUIDE.md`)
- [x] Add patient role to all existing scenarios
- [x] Update templates with patient role requirement
- [x] Document role system in `SPS_ROLES_EXTENSIBILITY.md`
- [x] Create authoring checklist

**Impact:** Authors now have complete documentation, but process is still manual.

---

### 🔄 **Phase 1: Command-Line Improvements** (IN PROGRESS)
**Timeline:** Week of October 23, 2025  
**Status:** 🔄 In Progress  
**Goal:** Make compilation and validation one-step

#### Tasks

- [ ] **Add compilation commands to package.json**
  - File: `backend/package.json`
  - Add: `"sps:compile": "tsx src/sps/tools/compile-content.ts"`
  - Add: `"sps:compile:watch": "tsx watch src/sps/tools/compile-content.ts --watch"`
  - Add: `"sps:build": "npm run sps:generate-manifests && tsx src/sps/tools/compile-content.ts && npm run build"`
  - **Impact:** Authors can run `npm run sps:build` instead of 4 separate commands

- [ ] **Create scenario generator CLI**
  - File: `backend/scripts/new-scenario.mjs`
  - Command: `npm run sps:new "Ankle Sprain" ankle_foot moderate`
  - Auto-generates: scenario ID, folder, all 6 JSON files with patient role
  - Pre-fills: timestamps, required fields, sensible defaults
  - **Impact:** Reduces setup time from 10 minutes to 10 seconds

- [ ] **Create validation helper script**
  - File: `backend/scripts/validate-scenario.mjs`
  - Command: `npm run sps:validate --scenario=<id>`
  - Shows: Missing required fields, formatting errors, helpful suggestions
  - Output: Plain English, not cryptic errors
  - **Impact:** Authors find errors before compile time

- [ ] **Add watch mode for auto-compilation**
  - Modify: `backend/src/sps/tools/compile-content.ts`
  - Command: `npm run sps:compile:watch`
  - Watches: `content/scenarios/bundles_src/**/*.json`
  - Auto-compiles: On file change
  - **Impact:** Authors see changes immediately in dev mode

**Success Metrics:**
- Scenario creation time: 10 minutes → 2 minutes (setup only)
- Build command confusion: Eliminated
- "It's not showing up" issues: Reduced 80%

---

### 📋 **Phase 2: Schema Simplification** (PLANNED)
**Timeline:** Week of October 30, 2025  
**Status:** 📋 Not Started  
**Goal:** Make more fields optional, reduce required knowledge

#### Tasks

- [ ] **Simplify presenting problem fields**
  - File: `backend/src/sps/core/types.ts`
  - Remove required: `onset_detail`, `pain_nrs_rest`, `pain_nrs_activity`, `pattern_24h`
  - Rename: `dominant_symptoms` → `chief_complaint`
  - Make optional: `aggravators`, `easers`
  - **Impact:** 10 fields → 6 fields, simpler language

- [ ] **Make ICF framework optional**
  - File: `backend/src/sps/core/types.ts`
  - Change: All ICF fields to optional
  - Add: Smart defaults based on region/diagnosis
  - **Impact:** Authors can skip academic framing for simple cases

- [ ] **Auto-generate test IDs**
  - File: `backend/src/sps/tools/compile-content.ts`
  - Logic: `obj_${region}_${sanitized_test_name}`
  - Remove: Test ID field from author-facing schema
  - **Impact:** One less technical field to manage

- [ ] **Simplify CAPTE/NPTE mapping**
  - File: `backend/src/sps/core/types.ts`
  - Make optional: `capte_refs`, `npte_map`
  - Add: Preset mappings per region
  - **Impact:** Authors can skip academic metadata

- [ ] **Add natural language test findings**
  - File: `backend/src/sps/core/types.ts`
  - Add field: `expected_finding: string` (free text)
  - Make optional: `patient_output_script` (structured data)
  - Parse: AI extracts structured data from natural language
  - **Impact:** "Hip flexion 105°, painful" vs complex JSON

**Success Metrics:**
- Required fields: 45 → 25
- Technical jargon: Reduced 60%
- Compilation errors: Reduced 50%

---

### 🔨 **Phase 3: Single-File Scenarios** (PLANNED)
**Timeline:** Week of November 6, 2025  
**Status:** 📋 Not Started  
**Goal:** One file per scenario instead of 6+

#### Tasks

- [ ] **Create unified scenario format**
  - New format: Single `scenario.json` with nested sections
  - Structure:
    ```json
    {
      "header": { /* header content */ },
      "soap": {
        "subjective": { /* subjective */ },
        "objective": { /* objective */ },
        "assessment": { /* assessment */ },
        "plan": { /* plan */ }
      },
      "instructions": { /* instructions */ }
    }
    ```
  - **Impact:** 6 files → 1 file per scenario

- [ ] **Update compilation to support both formats**
  - File: `backend/src/sps/tools/compile-content.ts`
  - Detect: Single-file vs multi-file format
  - Compile: Both formats to same output
  - **Impact:** Backward compatible, gradual migration

- [ ] **Create migration script**
  - File: `backend/scripts/migrate-to-single-file.mjs`
  - Command: `npm run sps:migrate --scenario=<id>`
  - Merges: 6 files → 1 file
  - Validates: No data loss
  - **Impact:** Easy migration of existing scenarios

- [ ] **Update generator script**
  - File: `backend/scripts/new-scenario.mjs`
  - Default: Create single-file scenarios
  - Option: `--multi-file` for old format
  - **Impact:** New scenarios use simpler format

**Success Metrics:**
- Files per scenario: 6 → 1
- "Which file do I edit?" questions: Eliminated
- Merge conflicts: Reduced 70%

---

### 🎨 **Phase 4: Web-Based Scenario Builder** (FUTURE)
**Timeline:** Q4 2025 / Q1 2026  
**Status:** 📋 Planning  
**Goal:** Build scenarios through UI, not JSON editing

#### Features (Prioritized)

**P0 - MVP (Must Have):**
- [ ] **Quick Mode: Essential Fields Only**
  - Single-page form
  - Fields: Title, Region, Diagnosis, Chief Complaint, Duration
  - Objective tests: Preset buttons ("Add Essential Tests" vs "Add Full Battery")
  - Natural language test findings (single textarea per test)
  - Estimated time: 5 minutes to create scenario

- [ ] **Auto-generate Scenario ID**
  - Format: `sc_${region}_${timestamp}_${random4}`
  - Show: After first save (read-only)
  - Remove: Manual ID entry entirely

- [ ] **Smart Test Presets by Region**
  - Hip: ROM, FADIR, FABER, Trendelenburg, Palpation GT, Strength, Gait
  - Knee: ROM, Lachman, McMurray, Patellar grind, Palpation, Gait
  - Ankle: ROM, Anterior drawer, Talar tilt, Balance, Palpation
  - Shoulder: ROM, Neer's, Hawkins-Kennedy, Empty can, Strength
  - Spine: ROM, Neuro screen, Palpation, Special tests

**P1 - Enhanced (Should Have):**
- [ ] **AI-First Workflow**
  - Modal: "Describe your scenario in plain English"
  - Input: "45yo runner with gradual onset anterior knee pain, worse with stairs, improving with rest"
  - Generate: Complete scenario draft from description
  - Refine: User edits generated content
  - Estimated time: 2 minutes to create scenario

- [ ] **Advanced Mode Toggle**
  - Hides: ICF framework, CAPTE/NPTE mapping, metadata
  - Shows: When "Show Advanced" clicked
  - Saves: User preference per session
  - Use case: <10% of scenarios need this

- [ ] **Real-time Validation**
  - Shows: Missing required fields as yellow highlights
  - Blocks: Save button until critical fields complete
  - Suggests: "Add at least 3 objective tests"
  - Prevents: Compilation errors

**P2 - Nice to Have:**
- [ ] **Visual Test Builder**
  - Drag-and-drop: Tests from palette to scenario
  - Preview: What student will see
  - Customize: Test parameters inline

- [ ] **Scenario Library Browser**
  - Search: By region, difficulty, diagnosis
  - Preview: Before opening
  - Clone: "Use as template" button

- [ ] **Collaborative Editing**
  - Share: Link to scenario for review
  - Comment: On specific fields
  - Version: History and rollback

**Success Metrics:**
- Adoption rate: 80% of new scenarios use UI
- Time-to-completion: <10 minutes (Quick Mode)
- JSON editing: Reduced 95%
- User satisfaction: 4.5/5 average

---

### 🧪 **Phase 5: Quality of Life Improvements** (FUTURE)
**Timeline:** Q1 2026  
**Status:** 📋 Ideas

- [ ] **Batch Operations**
  - Update: Multiple scenarios at once (e.g., add tag to all knee scenarios)
  - Export: Multiple scenarios to zip
  - Import: From external sources

- [ ] **Smart Defaults**
  - Pre-fill: Common values based on region/diagnosis
  - Suggest: Evidence sources based on diagnosis
  - Warn: If values seem unrealistic (e.g., "Pain 10/10 at rest but patient is smiling?")

- [ ] **Scenario Testing Mode**
  - Preview: Scenario as student would see it
  - Test: Run through encounter as QA
  - Record: Expected vs actual responses

- [ ] **Analytics Dashboard**
  - Show: Which scenarios are most used
  - Report: Common completion issues
  - Suggest: Scenarios needing updates

---

## Migration Strategy

### Backward Compatibility Plan

**Principle:** Never break existing scenarios

1. **Phase 1-2:** Additive only
   - Add new commands
   - Add optional fields
   - Keep existing format working

2. **Phase 3:** Dual-format support
   - Compiler handles both single-file and multi-file
   - New scenarios use single-file by default
   - Old scenarios remain untouched
   - Migration is opt-in

3. **Phase 4:** UI writes to new format
   - Web builder creates single-file scenarios
   - Can still edit multi-file scenarios
   - Suggests migration when opening old format

4. **Phase 5+:** Deprecation (if needed)
   - Announce: 6 months before removal
   - Provide: Automated migration tool
   - Support: Old format for 12 months after announcement

---

## Success Metrics

### Overall Goals

| Metric | Current | Phase 1 Target | Phase 4 Target |
|--------|---------|---------------|----------------|
| **Time to create scenario** | 20-30 min | 10-15 min | 5-10 min |
| **Files per scenario** | 6-8 files | 6-8 files | 1 file |
| **Required fields** | ~45 fields | ~45 fields | ~25 fields |
| **Compilation steps** | 4 manual | 1 command | Automatic |
| **Technical jargon exposed** | High | Medium | Low |
| **Author errors per scenario** | 3-5 | 1-2 | <1 |
| **New author onboarding time** | 2-3 hours | 1 hour | 15 minutes |
| **JSON editing required** | 100% | 100% | 5% |
| **User satisfaction** | 3.2/5 | 3.8/5 | 4.5/5 |

### Phase-Specific KPIs

**Phase 1 Success:**
- ✅ `npm run sps:build` works reliably
- ✅ `npm run sps:new` creates valid scenarios
- ✅ Watch mode reduces iteration time 80%
- ✅ Validation errors are understandable

**Phase 2 Success:**
- ✅ Scenarios compile with 40% fewer required fields
- ✅ Natural language test findings are parseable
- ✅ Compilation errors reduced 50%

**Phase 3 Success:**
- ✅ Single-file scenarios compile correctly
- ✅ 100% of existing scenarios migrate without data loss
- ✅ New authors choose single-file format 90% of time

**Phase 4 Success:**
- ✅ 80% of new scenarios created via UI
- ✅ Time-to-completion <10 minutes
- ✅ User satisfaction >4.2/5
- ✅ JSON editing required <10% of time

---

## User Testing Plan

### Phase 1 Testing (Command-Line)
**Participants:** 2-3 technical authors  
**Method:** Dogfooding - use new commands for real scenarios  
**Questions:**
- Does `npm run sps:build` always work?
- Is `npm run sps:new` output usable?
- What errors are confusing?

### Phase 2 Testing (Schema)
**Participants:** 3-5 clinical faculty  
**Method:** Author 2 scenarios with simplified schema  
**Questions:**
- Which fields are still confusing?
- What's missing from natural language test findings?
- Are smart defaults helpful?

### Phase 4 Testing (UI)
**Participants:** 5-8 faculty (mix of technical/non-technical)  
**Method:** Create scenarios with UI, compare to JSON editing  
**Questions:**
- How long did it take?
- What was confusing?
- Would you use this over JSON?
- What features are missing?

**Test Scenarios:**
- Simple case (entry-level PFPS)
- Moderate case (ACL injury)
- Complex case (post-op THA)

---

## Technical Debt & Risks

### Current Technical Debt
1. **Two compilation systems** (`compile-content.ts` in two locations)
2. **No automated tests** for scenario compilation
3. **Manual ID generation** in multiple places
4. **Inconsistent error handling** across tools

### Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **Breaking existing scenarios** | Medium | High | Extensive testing, phased rollout, rollback plan |
| **Low adoption of new tools** | Medium | Medium | User training, gradual migration, keep old method working |
| **AI generation produces invalid scenarios** | High | Medium | Validation layer, human review required |
| **Performance issues with watch mode** | Low | Low | Debounce compilation, optimize file watching |
| **Data loss during migration** | Low | High | Backup before migration, validate after, easy rollback |

---

## Resource Requirements

### Phase 1 (Week 1)
- **Development:** 8-12 hours
- **Testing:** 2-4 hours
- **Documentation:** 2 hours

### Phase 2 (Week 2-3)
- **Development:** 16-24 hours
- **Testing:** 4-6 hours
- **Documentation:** 3 hours

### Phase 3 (Week 4-5)
- **Development:** 24-32 hours
- **Testing:** 6-8 hours
- **Documentation:** 4 hours
- **Migration:** 4 hours

### Phase 4 (Months 2-3)
- **Development:** 80-120 hours
- **UI/UX Design:** 20-30 hours
- **Testing:** 20-30 hours
- **Documentation:** 8 hours
- **Training Materials:** 8 hours

---

## Next Actions

### This Week (October 23-27, 2025)

**Priority 1: Add Compilation Commands**
- [ ] Update `backend/package.json` with npm scripts
- [ ] Test `npm run sps:compile` works
- [ ] Test `npm run sps:build` end-to-end
- [ ] Update authoring guide with new commands

**Priority 2: Create Scenario Generator**
- [ ] Write `backend/scripts/new-scenario.mjs`
- [ ] Test scenario generation
- [ ] Verify generated files compile
- [ ] Add examples to documentation

**Priority 3: Document Current State**
- [ ] Audit all existing scenarios for patient role
- [ ] Measure current authoring time (baseline)
- [ ] Interview 2-3 authors about pain points
- [ ] Update this roadmap with findings

### Next Week (October 28 - November 3, 2025)

**Priority 1: Schema Simplification**
- [ ] Make ICF optional in TypeScript types
- [ ] Update compiler to handle optional fields
- [ ] Test with minimal scenarios
- [ ] Update templates

**Priority 2: Validation Helper**
- [ ] Create `validate-scenario.mjs` script
- [ ] Add helpful error messages
- [ ] Test with intentionally broken scenarios
- [ ] Document common errors

---

## Questions & Decisions Log

### Open Questions
1. **Single-file format:** JSON or YAML? (JSON easier to parse, YAML more readable)
2. **AI generation:** Which LLM API? Cost per scenario?
3. **Watch mode:** Compile on every save or debounce?
4. **Migration deadline:** When to deprecate multi-file format?

### Decisions Made
- ✅ **October 23:** Patient role is required in all scenarios
- ✅ **October 23:** Templates updated with patient role
- ✅ **October 23:** Comprehensive documentation created

### Decisions Needed
- ⏳ **Phase 1:** Which commands are most important?
- ⏳ **Phase 2:** How aggressive to simplify schema?
- ⏳ **Phase 3:** Single file format structure?
- ⏳ **Phase 4:** Build UI in React or use form builder?

---

## Related Documents

- **[SCENARIO_AUTHORING_GUIDE.md](ops/docs/SCENARIO_AUTHORING_GUIDE.md)** - Complete author guide
- **[SCENARIO_AUTHORING_CHECKLIST.md](ops/docs/SCENARIO_AUTHORING_CHECKLIST.md)** - Required elements
- **[SPS_CONTENT_AUTHORING.md](ops/docs/SPS_CONTENT_AUTHORING.md)** - Technical workflow
- **[CASE_BUILDER_SIMPLIFICATION_RECOMMENDATIONS.md](ops/docs/CASE_BUILDER_SIMPLIFICATION_RECOMMENDATIONS.md)** - UI improvement analysis
- **[SPS_ROLES_EXTENSIBILITY.md](SPS_ROLES_EXTENSIBILITY.md)** - Role system documentation

---

## Change Log

### October 23, 2025
- ✅ Created roadmap document
- ✅ Documented current pain points
- ✅ Defined 5 implementation phases
- ✅ Set success metrics
- ✅ Outlined next actions

---

**Document Owner:** Development Team  
**Review Cadence:** Weekly during active phases, monthly after completion  
**Feedback:** Add comments or suggestions as issues in the repository
