#!/usr/bin/env node
/*
Batch-generate "Easy" knee scenarios anchored to selected CPGs.
- Calls the backend generator endpoint for each diagnosis.
- Options: region='knee', difficulty='easy', setting='outpatient_pt', save=true
- After running, use existing tasks to compile and audit content.

Usage (Windows PowerShell):
  node scripts/sps-generate-knee-entry-cases.mjs

Configuration:
  - Set API_URL via environment if not localhost:3002
    $env:API_URL="http://localhost:3002"
*/

import fs from 'node:fs'
import path from 'node:path'

const API_URL = process.env.API_URL || 'http://localhost:3002'

const CASES = [
  // Knee ligament sprain CPG (Logerstedt 2017)
  {
    slug: 'mcl_grade1',
    title: 'Medial Collateral Ligament Sprain — Grade I',
    cpg: 'Logerstedt 2017 Knee Ligament Sprain CPG',
    dx: 'MCL sprain, Grade I',
    specialTests: ['Valgus stress 0°/30°'],
    personaHints: { age: [18, 25], sex: 'any', role: 'field sport' },
  },
  {
    slug: 'lcl_grade1',
    title: 'Lateral Collateral Ligament Sprain — Grade I',
    cpg: 'Logerstedt 2017 Knee Ligament Sprain CPG',
    dx: 'LCL sprain, Grade I',
    specialTests: ['Varus stress 0°/30°'],
    personaHints: { age: [18, 30], sex: 'any', role: 'court sport' },
  },
  {
    slug: 'acl_coper_nonop',
    title: 'ACL Sprain — Nonoperative Coper Profile (Entry)',
    cpg: 'Logerstedt 2017 Knee Ligament Sprain CPG',
    dx: 'ACL sprain (nonoperative coper profile)',
    specialTests: ['Lachman', 'Pivot shift (if appropriate)', 'Anterior drawer'],
    personaHints: { age: [18, 30], sex: 'any', role: 'pivoting athlete' },
  },
  {
    slug: 'pcl_grade1',
    title: 'Posterior Cruciate Ligament Sprain — Grade I',
    cpg: 'Logerstedt 2017 Knee Ligament Sprain CPG',
    dx: 'PCL sprain, Grade I',
    specialTests: ['Posterior drawer', 'Posterior sag (Godfrey)'],
    personaHints: { age: [18, 35], sex: 'any', role: 'recreational' },
  },
  // Meniscus/articular cartilage CPG (Logerstedt 2018)
  {
    slug: 'deg_medial_meniscus_nonlocking',
    title: 'Degenerative Medial Meniscus Tear (Non-locking)',
    cpg: 'Logerstedt 2018 Meniscus/Articular Cartilage CPG',
    dx: 'Degenerative medial meniscus pathology (non-locking)',
    specialTests: ['Thessaly', 'McMurray', 'Joint line tenderness'],
    personaHints: { age: [40, 65], sex: 'any', role: 'walker' },
  },
  {
    slug: 'post_partial_meniscectomy_stable',
    title: 'Post-Partial Meniscectomy — Early Stable Rehab',
    cpg: 'Logerstedt 2018 Meniscus/Articular Cartilage CPG',
    dx: 'Post-partial meniscectomy (early stable course)',
    specialTests: ['Effusion assessment', 'Quad index'],
    personaHints: { age: [30, 55], sex: 'any', role: 'desk worker' },
  },
  {
    slug: 'pf_articular_cartilage_nonop',
    title: 'Patellofemoral Articular Cartilage Lesion — Nonoperative',
    cpg: 'Logerstedt 2018 Meniscus/Articular Cartilage CPG',
    dx: 'Focal patellofemoral articular cartilage lesion (nonoperative)',
    specialTests: ['PF grind/crepitus', 'Squat pain monitoring'],
    personaHints: { age: [25, 45], sex: 'any', role: 'runner' },
  },
  // Patellofemoral pain CPG (Willy 2019)
  {
    slug: 'pfp_coordination_impairment',
    title: 'Patellofemoral Pain — Movement Coordination Impairment',
    cpg: 'Willy 2019 Patellofemoral Pain CPG',
    dx: 'Patellofemoral pain with dynamic valgus and hip weakness',
    specialTests: ['Single-leg squat observation', 'Step-down'],
    personaHints: { age: [18, 35], sex: 'any', role: 'runner' },
  },
  {
    slug: 'pfp_mobility_deficits',
    title: 'Patellofemoral Pain — Mobility Deficits',
    cpg: 'Willy 2019 Patellofemoral Pain CPG',
    dx: 'Patellofemoral pain with mobility deficits (limited ankle DF, tight lateral structures)',
    specialTests: ['Lunge test for DF', 'Thomas/ITB length hints'],
    personaHints: { age: [18, 35], sex: 'any', role: 'student' },
  },
  {
    slug: 'pfp_overuse_volume_error',
    title: 'Patellofemoral Pain — Overuse/Volume Error',
    cpg: 'Willy 2019 Patellofemoral Pain CPG',
    dx: 'Patellofemoral pain due to rapid volume increase',
    specialTests: ['Run/walk tolerance profile', 'Step-down'],
    personaHints: { age: [18, 40], sex: 'any', role: 'recreational runner' },
  },
  // Hamstring strain CPG (Martin 2022)
  {
    slug: 'hamstring_acute_bf_grade1',
    title: 'Hamstring Strain — Biceps Femoris Grade I (Sprinting)',
    cpg: 'Martin 2022 Hamstring Strain CPG',
    dx: 'Acute Grade I biceps femoris strain (sprinting)',
    specialTests: ['Resisted knee flexion at ~30°', 'Palpation tenderness trajectory'],
    personaHints: { age: [18, 30], sex: 'any', role: 'sprinter' },
  },
  {
    slug: 'hamstring_recurrent_risk_mgmt',
    title: 'Hamstring Strain — Recurrent Risk Management',
    cpg: 'Martin 2022 Hamstring Strain CPG',
    dx: 'Prior hamstring strain with recurrence risk; graded return-to-run',
    specialTests: ['Hamstring strength testing', 'Eccentric tolerance (Nordic options)'],
    personaHints: { age: [18, 35], sex: 'any', role: 'field sport' },
  },
]

function buildPrompt({ title, cpg, dx, specialTests }) {
  return `You are generating a novice-friendly outpatient physical therapy case strictly aligned with the following CPG: ${cpg}.
Diagnosis: ${dx}
Region: knee
Difficulty: easy (entry)
Setting: outpatient PT

Produce JSON-ready content for three files that our pipeline ingests:
1) scenario.header.json (meta: title='Entry: ${title}', region='knee', difficulty='easy', setting='outpatient_pt', tags include ['knee','easy','entry','${dx}']).
2) soap.subjective.json using buckets: Pain/HPI; Red flags; Function & SDOH; PMH/PSH/Medications/Allergies; Systems review; Goals.
3) soap.objective.json with region must-haves: observation; functional tests; strength; ROM; special tests (include: ${specialTests.join(', ')}); basic neuro as appropriate.

Constraints:
- Exclude red flags; keep within entry-level scope; no surgical pathways.
- Avoid PII; concise, clear, and audit-friendly.
- Faculty narrative rationale may be brief within header or a dedicated instructions block if supported.
- Mention high-level alignment to the CPG in a short provenance/sources field.
`
}

async function generateOne(caseDef) {
  const prompt = buildPrompt(caseDef)
  const body = { prompt, options: { region: 'knee', difficulty: 'easy', setting: 'outpatient_pt', research: false, save: true } }
  const url = `${API_URL}/api/sps/generate`
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const txt = await r.text().catch(() => '')
    throw new Error(`generate_http_${r.status}_${txt}`)
  }
  const data = await r.json()
  const scenario = data?.scenario
  if (!scenario || !scenario.scenario_id) {
    throw new Error('Missing scenario in generator response')
  }
  return { scenario_id: scenario.scenario_id, title: scenario.title || caseDef.title }
}

async function main() {
  console.log(`[GEN] Target API: ${API_URL}`)
  // Optional filter: --only=slug1,slug2
  const onlyArg = process.argv.find(a => a.startsWith('--only='))
  const only = onlyArg ? onlyArg.replace('--only=', '').split(',').map(s => s.trim()).filter(Boolean) : null
  const list = Array.isArray(only) && only.length ? CASES.filter(c => only.includes(c.slug)) : CASES
  const results = []
  for (const c of list) {
    try {
      const res = await generateOne(c)
      results.push({ ok: true, ...res })
      console.log(`✔ Generated: ${res.scenario_id} — ${res.title}`)
    } catch (err) {
      console.error(`✖ Failed: ${c.slug}`, err?.message || err)
      results.push({ ok: false, slug: c.slug, error: String(err?.message || err) })
    }
  }
  const reportPath = path.join(process.cwd(), 'scripts', 'knee-entry-gen-report.json')
  fs.writeFileSync(reportPath, JSON.stringify({ when: new Date().toISOString(), results }, null, 2))
  console.log(`[GEN] Done. Report: ${reportPath}`)
  console.log(`Next steps: run compile and audit tasks to integrate the new cases.`)
}

// Node 18+ has global fetch
main().catch(err => {
  console.error('[GEN] Fatal:', err)
  process.exit(1)
})
