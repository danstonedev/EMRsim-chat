# Easy Knee Cases: CPG-anchored Generation

This guide describes how to generate 12 entry-level ("easy") knee cases, each aligned with one of the provided CPGs, and integrate them into the app.

## CPG scope

Use only these CPGs:

1. Logerstedt et al., 2017 — Knee stability and movement coordination impairments: knee ligament sprain (revision 2017)
2. Logerstedt et al., 2018 — Knee pain and mobility impairments: meniscal and articular cartilage lesions (revision 2018)
3. Willy et al., 2019 — Patellofemoral pain
4. Martin et al., 2022 — Hamstring strain injury in athletes
5. Arundale et al., 2023 — Exercise-based knee and ACL injury prevention (optional prevention/screen case)

## Cases

- Ligament (2017): MCL grade I, LCL grade I, ACL sprain (non-op coper), PCL grade I
- Meniscus/Cartilage (2018): Degenerative medial meniscus (non-locking), Early post-partial meniscectomy (stable), PF articular cartilage lesion (non-op)
- Patellofemoral pain (2019): PFP with coordination impairment, PFP with mobility deficits, PFP with overuse/volume error
- Hamstring (2022): Acute BF grade I (sprinting), Recurrent hamstring strain risk management

All set as:

- region: `knee`
- difficulty: `easy`
- setting: `outpatient_pt`

## Files produced per case

- `scenario.header.json`: title, region, difficulty, setting, tags, persona link or suggestions, provenance
- `soap.subjective.json`: Buckets — Pain/HPI; Red flags; Function & SDOH; PMH/PSH/Medications/Allergies; Systems review; Goals
- `soap.objective.json`: observation; functional tests; strength; ROM; special tests (CPG-appropriate); basic neuro

Student-safe `student_case_id` is derived at compile time.

## Batch generation

Script: `scripts/sps-generate-knee-entry-cases.mjs`

- Calls POST `/api/sps/generate` for each diagnosis
- Options: `{ region: 'knee', difficulty: 'easy', setting: 'outpatient_pt', research: false, save: true }`
- Writes `scripts/knee-entry-gen-report.json`

Environment (Windows PowerShell):

```powershell
$env:API_URL = "http://localhost:3002"  # if not default
node scripts/sps-generate-knee-entry-cases.mjs
```

## Compile + audit

After generation, run:

```powershell
# Validate + audit
cd backend
npm run -s sps:validate
npm run -s sps:audit
```

Both should pass with 0 errors (warnings ideally 0). Fix any flagged bucket gaps or missing knee must-haves, then re-run.

## UI verification

- Open the app setup modal
- Set Region: Knee and Difficulty: Easy
- You should see the new cases. Students see non-revealing IDs; faculty see full titles.

## Persona linkage

- The generator can set `persona_id` or leave it blank and use `suggested_personas`
- Prefer personas that match age/sex/activity implied by the diagnosis

## Notes

- To swap a case, edit the `CASES` array inside `sps-generate-knee-entry-cases.mjs` and re-run
- To add the ACL prevention screen case, replace one hamstring case and update the prompt accordingly
