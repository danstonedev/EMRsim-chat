#!/usr/bin/env node
/*
Professor audit: Verify newly generated scenarios meet CPG anchoring,
learning objectives, and audit cleanliness before final approval.

Usage (Windows PowerShell):
  # Audit all knee/easy scenarios
  node scripts/professor-audit.mjs --region=knee --difficulty=easy

  # Audit a subset by slug
  node scripts/professor-audit.mjs --only=mcl_grade1,pfp_coordination_impairment

Optional write-back to mark approval in headers:
  node scripts/professor-audit.mjs --only=... --write-approval --reviewer="Prof. Reviewer"
*/

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const BUNDLES_DIR = path.join(ROOT, 'backend', 'src', 'sps', 'content', 'scenarios', 'bundles_src')
const AUDIT_JSON = path.join(ROOT, 'scripts', 'content-audit-report.json')

function walkDirs(base) {
  return fs.readdirSync(base).filter((d) => fs.statSync(path.join(base, d)).isDirectory())
}

function safeReadJson(p) {
  try {
    const txt = fs.readFileSync(p, 'utf8')
    return JSON.parse(txt)
  } catch {
    return null
  }
}

function hasCpgProvenance(header) {
  const srcs = header?.provenance?.sources
  if (!Array.isArray(srcs)) return false
  return srcs.some((s) => {
    const lvl = String(s?.level_of_evidence || '').toUpperCase()
    const id = String(s?.identifier || '')
    const title = String(s?.title || '')
    return lvl.includes('CPG') || /CPG/i.test(id) || /CPG/i.test(title)
  })
}

function hasLearningObjectives(header) {
  const los = header?.pedagogy?.learning_objectives
  return Array.isArray(los) && los.length > 0
}

function matchesFilters(header, filters) {
  const region = String(header?.meta?.region || header?.region || '').toLowerCase()
  const difficulty = String(header?.meta?.difficulty || header?.difficulty || '').toLowerCase()
  if (filters.region && region !== String(filters.region).toLowerCase()) return false
  if (filters.difficulty && difficulty !== String(filters.difficulty).toLowerCase()) return false
  return true
}

function getAuditFindingsForScenario(audit, scenarioId) {
  if (!audit) return { errors: 0, warnings: 0, notes: [] }
  const items = Array.isArray(audit?.items) ? audit.items : []
  const matched = items.filter((x) => x?.scenario_id === scenarioId)
  let errors = 0
  let warnings = 0
  const notes = []
  for (const it of matched) {
    errors += Number(it?.errors || 0)
    warnings += Number(it?.warnings || 0)
    if (Array.isArray(it?.messages)) notes.push(...it.messages)
  }
  return { errors, warnings, notes }
}

function scenarioSlugFromDir(dirName) {
  // e.g., sc_knee_mcl_grade1_entry_v1 -> mcl_grade1
  const parts = dirName.split('_')
  if (parts.length < 5) return dirName
  // sc knee mcl grade1 entry v1
  return parts.slice(2, parts.length - 2).join('_')
}

function applyApproval(headerPath, reviewer) {
  const header = safeReadJson(headerPath) || {}
  header.professor_review = {
    status: 'approved',
    reviewer: reviewer || 'DPT Professor Reviewer',
    date: new Date().toISOString(),
  }
  fs.writeFileSync(headerPath, JSON.stringify(header, null, 2))
}

async function main() {
  const args = process.argv.slice(2)
  const onlyArg = args.find((a) => a.startsWith('--only='))
  const only = onlyArg ? onlyArg.replace('--only=', '').split(',').map((s) => s.trim()).filter(Boolean) : null
  const regionArg = args.find((a) => a.startsWith('--region='))
  const region = regionArg ? regionArg.split('=')[1] : null
  const difficultyArg = args.find((a) => a.startsWith('--difficulty='))
  const difficulty = difficultyArg ? difficultyArg.split('=')[1] : null
  const writeApproval = args.includes('--write-approval')
  const reviewerArg = args.find((a) => a.startsWith('--reviewer='))
  const reviewer = reviewerArg ? reviewerArg.split('=')[1] : 'DPT Professor Reviewer'

  const audit = safeReadJson(AUDIT_JSON)
  const dirs = walkDirs(BUNDLES_DIR)

  const results = []

  for (const d of dirs) {
    const headerPath = path.join(BUNDLES_DIR, d, 'scenario.header.json')
    const subjPath = path.join(BUNDLES_DIR, d, 'soap.subjective.json')
    const objPath = path.join(BUNDLES_DIR, d, 'soap.objective.json')
    const header = safeReadJson(headerPath)
    if (!header) continue

    const slug = scenarioSlugFromDir(d)
    if (only && !only.includes(slug)) continue

    if (!matchesFilters(header, { region, difficulty })) continue

    const scenarioId = header?.scenario_id || d
    const provenanceOk = hasCpgProvenance(header)
    const loOk = hasLearningObjectives(header)
    const subjOk = !!safeReadJson(subjPath)
    const objOk = !!safeReadJson(objPath)
    const af = getAuditFindingsForScenario(audit, scenarioId)

    const ok = provenanceOk && loOk && subjOk && objOk && af.errors === 0 && af.warnings === 0

    results.push({
      dir: d,
      scenario_id: scenarioId,
      slug,
      ok,
      provenanceOk,
      learningObjectivesOk: loOk,
      subjectiveOk: subjOk,
      objectiveOk: objOk,
      auditErrors: af.errors,
      auditWarnings: af.warnings,
    })

    if (ok && writeApproval) {
      try { applyApproval(headerPath, reviewer) } catch {}
    }
  }

  const summary = {
    total: results.length,
    approved: results.filter((r) => r.ok).length,
    pending: results.filter((r) => !r.ok).length,
    filters: { region, difficulty, only },
  }

  console.table(results.map(r => ({ slug: r.slug, ok: r.ok, errs: r.auditErrors, warns: r.auditWarnings, provenance: r.provenanceOk, LOs: r.learningObjectivesOk })))
  console.log('[PROF-AUDIT] Summary:', summary)

  // Non-zero exit on pending items for CI enforcement
  if (summary.pending > 0) process.exitCode = 2
}

main().catch((e) => { console.error('[PROF-AUDIT] Fatal', e); process.exit(1) })
