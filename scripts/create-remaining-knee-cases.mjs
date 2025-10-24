#!/usr/bin/env node
/*
Manual case creator - generates the remaining 5 knee entry cases
Run: node scripts/create-remaining-knee-cases.mjs
*/

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const BUNDLES = path.join(ROOT, 'backend', 'src', 'sps', 'content', 'scenarios', 'bundles_src')

const CASES = [
  {
    dir: 'sc_knee_pcl_grade1_entry_v1',
    files: {
      'soap.subjective.json': {
        history: { chief_complaint: "I hit my shin on the dashboard—now my knee feels unstable going downstairs.", mechanism: "Dashboard injury; posterior force to proximal tibia.", prior_episodes: "No prior knee injuries.", functional_impact: "Stairs descent hurts; kneeling uncomfortable.", goals: "Get back to basketball pain-free.", identity: { name: "Ryan Mitchell", dob: "1994-06-15" } },
        subjective_catalog: [
          { id: "meds_allergies", label: "Medications & Allergies", patterns: ["meds", "allergies"], patient_response_script: { qualitative: ["Took ibuprofen. No allergies."] } },
          { id: "swelling", label: "Swelling", patterns: ["swelling"], patient_response_script: { qualitative: ["A bit puffy behind the knee initially."] } },
          { id: "red_flags", label: "Red Flags", patterns: ["locking", "giving way"], patient_response_script: { qualitative: ["No locking. Feels unstable sometimes on stairs."] } }
        ],
        patient_reported_outcomes: { NPRS_worst: 4, NPRS_usual: 2, LEFS: 58 },
        media_library: [],
        history_present_illness: { mechanism: "dashboard injury", first_onset: "2 weeks ago", course_since_onset: "improving slowly", prior_episodes: "none", red_flag_denials_affirmations: { fever: false, locking: false, numbness: false } },
        pain: { location: ["posterior knee"], quality: ["ache"], irritability: "low-moderate", nrs_rest: 1, nrs_activity: 4, aggravators: ["stairs descent", "kneeling"], easers: ["rest"], "24h_pattern": "stiff morning" },
        social_history: { sport_hobbies: ["basketball"], occupation: "engineer" },
        goals: ["return to basketball", "no pain descending stairs"],
        past_medical_history: [], surgical_history: [], medications: [{ name: "ibuprofen", dose: "as needed" }], allergies: [{ substance: "drug", details: "none" }]
      },
      'soap.objective.json': {
        objective_catalog: [
          { test_id: "vitals", label: "Vitals", template: "vitals", findings: { bp: "122/74", hr: 66, rr: 14, spo2: 99 } },
          { test_id: "inspection", label: "Inspection", template: "inspection", findings: { effusion: "mild posterior", ecchymosis: "resolved", gait: "normal" }, difficulty: "easy" },
          { test_id: "rom", label: "ROM", template: "rom", findings: { knee_ext_right_deg: 0, knee_flex_right_deg: 130, knee_ext_left_deg: 0, knee_flex_left_deg: 135, pain_end_range: "mild posterior discomfort flexion" }, difficulty: "easy" },
          { test_id: "posterior_drawer", label: "Posterior Drawer", template: "ligament_test", findings: { posterior_translation: "increased vs contralateral (Grade I)", end_feel: "soft" }, difficulty: "easy" },
          { test_id: "posterior_sag", label: "Posterior Sag (Godfrey)", template: "ligament_test", findings: { sag: "mild positive", comparison: "vs contralateral" }, difficulty: "easy" },
          { test_id: "other_tests", label: "Other Ligament Screen", template: "screening", findings: { lachman: "negative", valgus: "negative", varus: "negative" }, difficulty: "easy" },
          { test_id: "palpation", label: "Palpation", template: "palpation", findings: { posterior_knee_tenderness: "positive", joint_line: "none" }, difficulty: "easy" },
          { test_id: "functional", label: "Functional", template: "functional_task", findings: { step_down_pain: 3, squat_pain: 2 }, difficulty: "easy" }
        ],
        contraindications_precautions: ["Avoid posterior tibial forces; emphasize quad strengthening."]
      },
      'instructions.json': {
        scenario_instruction_overrides: {
          tone: "Subacute injury; patient cooperative.", behavioral_notes: ["Wait for student.", "If asked identity: Ryan Mitchell, DOB 1994-06-15.", "If posterior tests aggressive, ask if safe."],
          gates: { requires_name_dob_before_sensitive: true }, safety_prompts: ["If pain >3/10, request scaling."]
        }
      }
    }
  }
]

for (const c of CASES) {
  const dir = path.join(BUNDLES, c.dir)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  for (const [file, content] of Object.entries(c.files)) {
    const fp = path.join(dir, file)
    fs.writeFileSync(fp, JSON.stringify(content, null, 2))
    console.log(`✔ ${c.dir}/${file}`)
  }
}
console.log('Done!')
