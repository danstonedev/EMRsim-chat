# Scenario Authoring Checklist

This checklist ensures all required elements are included when creating or modifying SPS scenarios.

## Required Files

- [ ] `scenario.header.json` - Metadata, pedagogy, and role definitions
- [ ] `instructions.json` - Scenario-specific instructions
- [ ] `soap.subjective.json` - Subjective history content
- [ ] `soap.objective.json` - Objective findings and tests
- [ ] `soap.assessment.json` - Assessment content
- [ ] `soap.plan.json` - Treatment plan content

## Required: Patient Role Declaration

**All scenarios MUST include a patient role in `scenario.header.json`:**

```json
{
  "meta": {
    "title": "Your Scenario Title",
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

### Why This Matters

- `"instruction": null` uses the comprehensive built-in patient role directive (`BUILTIN_ROLE_TEMPLATES.patient`)
- Ensures consistent patient behavior across all scenarios
- Provides 17 standard patient behavior rules including:
  - Turn-taking (wait for student to speak first)
  - Identity verification protocols
  - Conversational pacing
  - Boundary setting
  - Tone and rapport maintenance

### When to Override

You can provide a custom `instruction` string instead of `null` for scenario-specific patient behavior, but this is rarely needed. Only override if:

- The scenario requires unique patient behavior not covered by the built-in template
- You need to add scenario-specific behavioral quirks
- The clinical situation demands a different interaction pattern

## Metadata Requirements

### Header (`meta` section)

- [ ] `title` - Clear, descriptive title
- [ ] `region` - Valid anatomical region (knee, hip, shoulder, etc.)
- [ ] `difficulty` - One of: `easy`, `moderate`, `advanced`
- [ ] `setting` - Valid clinical setting
- [ ] `tags` - Relevant tags for searchability
- [ ] `profession` - Target profession (usually `physical_therapy`)
- [ ] **`roles`** - REQUIRED patient role array (see above)
- [ ] `created_at` - ISO timestamp
- [ ] `updated_at` - ISO timestamp

### Pedagogy

- [ ] At least one learning objective with:
  - [ ] `id` - Unique identifier
  - [ ] `text` - Clear learning objective
  - [ ] `bloom_level` - Appropriate cognitive level
  - [ ] `capte_refs` - Relevant CAPTE standards
  - [ ] `npte_map` - NPTE domain mapping
  - [ ] `assessment_focus` - What will be assessed
  - [ ] `evidence_req` - Evidence requirement level

### Presenting Problem

- [ ] `primary_dx` - Primary diagnosis/concern
- [ ] `onset` - Acute, gradual, or insidious
- [ ] `duration_weeks` - Numeric duration
- [ ] `dominant_symptoms` - Array of key symptoms
- [ ] `pain_nrs_rest` - Pain at rest (0-10)
- [ ] `pain_nrs_activity` - Pain with activity (0-10)
- [ ] `aggravators` - What makes it worse
- [ ] `easers` - What makes it better
- [ ] `pattern_24h` - Daily pattern description
- [ ] `red_flags_ruled_out` - Boolean (should be `true`)

### ICF Framework

- [ ] `health_condition` - Primary health condition
- [ ] `body_functions_structures` - Impairments
- [ ] `activities` - Activity limitations
- [ ] `participation` - Participation restrictions
- [ ] `environmental_factors` - Environmental considerations
- [ ] `personal_factors` - Personal factors affecting case

## Content Quality

### Subjective Content

- [ ] Includes prepared responses for common questions
- [ ] Media references use correct `[MEDIA:id]` format
- [ ] Responses align with persona characteristics
- [ ] History is internally consistent

### Objective Content

- [ ] All tests have appropriate findings
- [ ] Guardrails specified (contraindications, precautions)
- [ ] Findings match the clinical diagnosis
- [ ] Test difficulty calibrated appropriately

### SOAP Notes

- [ ] Assessment includes differential diagnosis reasoning
- [ ] Plan includes evidence-based interventions
- [ ] Goals are SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
- [ ] Education points align with patient needs

## Compilation & Validation

After authoring, run these commands:

```bash
# Compile the scenario
npm run sps:compile --scenario=<scenario_id>

# Validate the compiled output
npm run sps:validate-compiled

# Generate updated manifests
npm run sps:generate-manifests
```

## Final Checks

- [ ] All JSON files are valid (no syntax errors)
- [ ] Scenario compiles without errors
- [ ] Validation passes
- [ ] Manifests regenerated
- [ ] Patient role is declared in `meta.roles`
- [ ] Changes committed to version control

## Common Mistakes to Avoid

1. **Forgetting the patient role** - All scenarios MUST have `meta.roles` with patient role
2. **Inconsistent pain ratings** - Ensure rest/activity pain makes clinical sense
3. **Missing media markers** - Use `[MEDIA:id]` format, not plain text references
4. **Unrealistic guardrails** - Don't make every test unsafe; be selective
5. **Vague learning objectives** - Be specific and measurable
6. **Missing evidence requirements** - Always specify CPG, systematic review, or RCT
7. **Incomplete ICF** - All five domains should be considered
8. **Timeline mismatches** - Ensure onset, duration, and history align

## Resources

- **[SPS_CONTENT_AUTHORING.md](SPS_CONTENT_AUTHORING.md)** - Complete authoring guide
- **[SPS_ROLES_EXTENSIBILITY.md](../../SPS_ROLES_EXTENSIBILITY.md)** - Multi-role system documentation
- **[LLM_CASE_GENERATION_PROMPT_KIT.md](LLM_CASE_GENERATION_PROMPT_KIT.md)** - AI-assisted case generation
- **Template files** in `backend/src/sps/authoring/templates/scenario/`
