import { Router, Request, Response } from 'express';
import { spsRegistry } from '../sps/core/registry.ts';
import { getSuggestedPersonas, loadScenarioKit, mapScenarioToCaseId, retrieveFacts } from '../sps/runtime/kits.ts';
import {
  getGoldInstructions,
  formatPersonaSection as fmtPersona,
  formatScenarioSection as fmtScenario,
} from '../sps/runtime/sps.service.ts';
import { getStorageMode } from '../db.ts';
import { catalogService } from '../services/catalogService.ts';
import type {
  ClinicalScenario,
  PatientPersona,
  PresentingProblem,
  ICF,
  ScenarioContext,
  SymptomFluctuation,
  ScenarioGuardrails,
  ObjectiveGuardrails,
  ScenarioInstructions,
  ScenarioProvenance,
  ScenarioSOAP,
  ScenarioSOAPKey,
  ObjectiveFinding,
  SubjectiveItem,
  SpecialQuestion,
  ScreeningChallenge,
} from '../sps/core/types.ts';

export const router = Router();

// Best-effort lazy loader in case boot-time SPS import failed
async function ensureSPSLoaded(): Promise<void> {
  try {
    const hasContent = Object.keys(spsRegistry.personas).length > 0 || Object.keys(spsRegistry.scenarios).length > 0;
    if (hasContent) return;
    const mod = await import('../sps/runtime/session.ts');
    if (typeof mod.loadSPSContent === 'function') {
      mod.loadSPSContent();
    }
  } catch (e) {
    console.warn('[sps][lazy-load][warn]', String(e));
  }
}

// Helper to generate unique scenario ID
// Authoring helpers removed in runtime-only mode

// Gold standard instructions (dev/instructor aid)
router.get('/instructions', (_req: Request, res: Response) => {
  res.json({ instructions: getGoldInstructions() });
});

// Debug endpoint: quick visibility into counts and storage mode
router.get('/debug', (_req: Request, res: Response) => {
  try {
    const regScenarioCount = Object.keys(spsRegistry.scenarios).length;
    const regPersonaCount = Object.keys(spsRegistry.personas).length;
    // DB-backed authoring is disabled for runtime catalog; report 0 to avoid confusion
    const dbScenarioCount = 0;

    res.json({
      ok: true,
      storage: getStorageMode(),
      counts: {
        registry: { scenarios: regScenarioCount, personas: regPersonaCount },
        db: { scenarios: dbScenarioCount },
        merged: { scenarios: regScenarioCount },
      },
      endpoints: {
        scenarios: '/api/sps/scenarios',
        personas: '/api/sps/personas',
      },
      notes: [
        'Runtime catalog now uses a single source: file-based registry only (no DB merge).',
        'Use /api/sps/* for personas and scenarios.',
        'Scenario-linked persona files are ignored at runtime (content/personas/shared and persona.json in bundles).',
      ],
    });
  } catch (e) {
    console.error('[sps][debug][error]', e);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// Scenarios catalog (metadata only)
router.get('/scenarios', async (_req: Request, res: Response) => {
  // Single-source catalog: registry (file-based) only
  try {
    await ensureSPSLoaded();
    const scenarios = Object.values(spsRegistry.scenarios).map(s => ({
      scenario_id: s.scenario_id,
      student_case_id: (s as any).student_case_id || null,
      title: s.title,
      region: s.region,
      difficulty: s.difficulty,
      setting: s.setting,
      tags: s.tags || [],
      persona_id: s.linked_persona_id || s.persona_snapshot?.id || null,
      persona_name: s.persona_snapshot?.display_name || null,
      persona_headline: s.persona_snapshot?.headline || null,
      suggested_personas: getSuggestedPersonas(s.scenario_id).map(p => p.id),
      guardrails: s.guardrails || undefined,
    }));
    res.json({ scenarios });
  } catch (e) {
    console.error('[sps][scenarios][error]', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Generate a scenario with AI (does not auto-save unless requested)
// Authoring endpoints removed: scenario generation is disabled in runtime-only mode

// SPS personas (distinct from legacy /api/personas set)
router.get('/personas', async (_req: Request, res: Response) => {
  await ensureSPSLoaded();
  const personas = Object.values(spsRegistry.personas).map(p => ({
    id: p.patient_id,
    display_name: p.display_name || p.demographics?.preferred_name || p.demographics?.name || p.patient_id,
    headline: (() => {
      if (p.headline) return p.headline;
      const goals = Array.isArray(p.function_context?.goals) ? p.function_context.goals : [];
      return goals && goals.length ? goals[0] : null;
    })(),
    age: p.demographics?.age,
    sex: p.demographics?.sex,
    voice: p.voice_id || p.dialogue_style?.voice_id || null,
    tags: Array.isArray(p.tags) ? p.tags : undefined,
  }));
  res.json({ personas });
});

// Get single persona by ID
router.get('/personas/:id', (req: Request, res: Response) => {
  try {
    const personaId = req.params.id;
    const persona = spsRegistry.personas[personaId];

    if (!persona) {
      return res.status(404).json({ error: 'persona_not_found' });
    }

    // Add version headers for cache invalidation
    const contentVersion = (persona as any).content_version || '1.0.0';
    res.setHeader('X-Content-Version', contentVersion);
    res.setHeader('ETag', `"${personaId}-${contentVersion}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600, must-revalidate');

    res.json({ persona });
  } catch (e) {
    console.error('[sps][persona-detail][error]', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ============================================================================
// CATALOG ENDPOINTS (V3 Architecture)
// ============================================================================

// Get special tests catalog
router.get('/catalogs/tests/special', async (_req: Request, res: Response) => {
  try {
    const catalog = await catalogService.getCatalog('special_tests');
    res.json(catalog);
  } catch (e) {
    console.error('[sps][catalogs][special_tests][error]', e);
    res.status(500).json({ error: 'failed_to_load_catalog' });
  }
});

// Get functional tests catalog
router.get('/catalogs/tests/functional', async (_req: Request, res: Response) => {
  try {
    const catalog = await catalogService.getCatalog('functional_tests');
    res.json(catalog);
  } catch (e) {
    console.error('[sps][catalogs][functional_tests][error]', e);
    res.status(500).json({ error: 'failed_to_load_catalog' });
  }
});

// Get interventions catalog
router.get('/catalogs/interventions', async (_req: Request, res: Response) => {
  try {
    const catalog = await catalogService.getCatalog('interventions');
    res.json(catalog);
  } catch (e) {
    console.error('[sps][catalogs][interventions][error]', e);
    res.status(500).json({ error: 'failed_to_load_catalog' });
  }
});

// Get outcome measures catalog
router.get('/catalogs/outcomes', async (_req: Request, res: Response) => {
  try {
    const catalog = await catalogService.getCatalog('outcomes');
    res.json(catalog);
  } catch (e) {
    console.error('[sps][catalogs][outcomes][error]', e);
    res.status(500).json({ error: 'failed_to_load_catalog' });
  }
});

// Get ROM norms catalog
router.get('/catalogs/norms/rom', async (_req: Request, res: Response) => {
  try {
    const catalog = await catalogService.getCatalog('rom_norms');
    res.json(catalog);
  } catch (e) {
    console.error('[sps][catalogs][rom_norms][error]', e);
    res.status(500).json({ error: 'failed_to_load_catalog' });
  }
});

// Get safety thresholds catalog
router.get('/catalogs/safety', async (_req: Request, res: Response) => {
  try {
    const catalog = await catalogService.getCatalog('safety');
    res.json(catalog);
  } catch (e) {
    console.error('[sps][catalogs][safety][error]', e);
    res.status(500).json({ error: 'failed_to_load_catalog' });
  }
});

// Get protocol sources catalog
router.get('/catalogs/protocols', async (_req: Request, res: Response) => {
  try {
    const catalog = await catalogService.getCatalog('protocols');
    res.json(catalog);
  } catch (e) {
    console.error('[sps][catalogs][protocols][error]', e);
    res.status(500).json({ error: 'failed_to_load_catalog' });
  }
});

// ============================================================================

// Create or update a scenario (authoring)
// Authoring endpoints removed: saving/updating scenarios is disabled in runtime-only mode

router.get('/scenarios/:id', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '');
    if (!id) return res.status(400).json({ error: 'bad_request' });
    // Single source: registry only
    const scenario = spsRegistry.scenarios[id] || null;
    if (!scenario) return res.status(404).json({ error: 'not_found' });

    // Add version headers for cache invalidation
    const contentVersion = (scenario as any).content_version || '1.0.0';
    res.setHeader('X-Content-Version', contentVersion);
    res.setHeader('ETag', `"${id}-${contentVersion}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600, must-revalidate');

    res.json({ scenario });
  } catch (e) {
    console.error('[sps][scenarios][get][error]', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

// Printable HTML export of a scenario + persona
// GET /api/sps/export?persona_id=...&scenario_id=...
export const exportRouter = Router();
exportRouter.get('/export', (req: Request, res: Response) => {
  try {
    const personaId = String(req.query.persona_id || '');
    const scenarioId = String(req.query.scenario_id || '');
    const audienceParam = String(req.query.audience || '').toLowerCase();
    const audience: 'student' | 'faculty' | null =
      audienceParam === 'faculty' ? 'faculty' : audienceParam === 'student' ? 'student' : null;
    if (!personaId || !scenarioId) return res.status(400).send('Missing persona_id or scenario_id');
    const persona: PatientPersona | undefined = spsRegistry.personas[personaId];
    const scenario: ClinicalScenario | undefined = spsRegistry.scenarios[scenarioId];
    if (!persona || !scenario) return res.status(404).send('Persona or scenario not found');

    const gold = getGoldInstructions()?.trim?.() || '';
    const specials = spsRegistry.getScenarioSpecials(scenario);
    const challenges = spsRegistry.getScenarioChallenges(scenario);
    const objectives: ObjectiveFinding[] = scenario.objective_catalog ?? [];
    // Fallback map: some compiled scenarios store concrete findings under soap.objective.objective_catalog
    const soapObjectiveCatalog: any[] = (scenario as any)?.soap?.objective?.objective_catalog || [];
    const soapObjectiveFindingsByKey: Map<string, any> = new Map();
    for (const item of soapObjectiveCatalog) {
      const findings = (item && (item.findings || {})) || {};
      const idKey = String(item?.test_id || '').toLowerCase();
      const labelKey = String(item?.label || '').toLowerCase();
      if (idKey) soapObjectiveFindingsByKey.set(idKey, findings);
      if (labelKey) soapObjectiveFindingsByKey.set(labelKey, findings);
    }
    const objectiveGuardrails: ObjectiveGuardrails = scenario.objective_guardrails ?? {};

    const escapeHtml = (s: string) =>
      String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c as '&' | '<' | '>'] || c);
    const safeText = (value: any): string => {
      if (value === undefined || value === null) return '';
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';
      if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toLocaleDateString();
      if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
      return String(value);
    };
    const formatDate = (value: any): string => {
      if (!value) return '';
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? safeText(value) : d.toLocaleDateString();
    };
    const renderDefinitionList = (rows: Array<{ label: string; value?: any; html?: string }>): string => {
      const entries = rows
        .map(({ label, value, html }) => {
          if (html) return `<dt>${escapeHtml(label)}</dt><dd>${html}</dd>`;
          const text = safeText(value);
          if (!text) return '';
          return `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(text)}</dd>`;
        })
        .filter(Boolean);
      return entries.length ? `<dl class="detail-grid">${entries.join('')}</dl>` : '';
    };
    const renderList = (items: any): string => {
      const arr = Array.isArray(items) ? items.map(item => safeText(item)).filter(Boolean) : [];
      return arr.length
        ? `<ul class="plain-list">${arr.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
        : '';
    };
    const renderKeyValue = (obj: any): string => {
      if (!obj || typeof obj !== 'object') return '';
      const entries = Object.entries(obj)
        .map(([key, value]) => {
          const text = safeText(value);
          if (!text) return '';
          return `<li><code>${escapeHtml(key)}</code>: ${escapeHtml(text)}</li>`;
        })
        .filter(Boolean);
      return entries.length ? `<ul class="plain-list">${entries.join('')}</ul>` : '';
    };
    const renderChips = (items: any): string => {
      const arr = Array.isArray(items) ? items.map(item => safeText(item)).filter(Boolean) : [];
      return arr.length
        ? `<div class="chip-row">${arr.map(item => `<span class="chip">${escapeHtml(item)}</span>`).join('')}</div>`
        : '';
    };

  const personaBlock = escapeHtml(fmtPersona(persona)).replace(/\n/g, '<br/>');
  const scenarioSummaryBlock = escapeHtml(fmtScenario(scenario)).replace(/\n/g, '<br/>');

    const metaRows = [
      { label: 'Schema version', value: scenario.schema_version },
      { label: 'Status', value: scenario.status },
      { label: 'Version', value: scenario.version ? `v${scenario.version}` : '' },
      { label: 'Region', value: scenario.region },
      { label: 'Difficulty', value: scenario.difficulty },
      { label: 'Setting', value: scenario.setting },
      { label: 'Profession', value: scenario.meta?.profession },
      { label: 'Created', value: formatDate(scenario.meta?.created_at) },
      { label: 'Updated', value: formatDate(scenario.meta?.updated_at) },
    ];
    const metaContent = [renderDefinitionList(metaRows), renderChips(scenario.tags)].filter(Boolean).join('');

    const pedagogy = scenario.pedagogy || {};
    const learningObjectives = Array.isArray(pedagogy.learning_objectives)
      ? pedagogy.learning_objectives.filter((obj: any) => obj && obj.text)
      : [];
    const learningObjectivesHtml = learningObjectives
      .map((lo: any) => {
        const metaParts = [];
        if (lo.bloom_level) metaParts.push(`Bloom: ${safeText(lo.bloom_level)}`);
        if (Array.isArray(lo.capte_refs) && lo.capte_refs.length)
          metaParts.push(`CAPTE: ${lo.capte_refs.map((ref: any) => safeText(ref)).join(', ')}`);
        if (lo.npte_map) {
          const npteParts = [lo.npte_map.system, lo.npte_map.domain, lo.npte_map.nonsystem]
            .map((part: any) => safeText(part))
            .filter(Boolean);
          if (npteParts.length) metaParts.push(`NPTE: ${npteParts.join(' / ')}`);
        }
        if (Array.isArray(lo.assessment_focus) && lo.assessment_focus.length)
          metaParts.push(`Focus: ${lo.assessment_focus.map((ref: any) => safeText(ref)).join(', ')}`);
        if (lo.evidence_req) metaParts.push(`Evidence: ${safeText(lo.evidence_req)}`);
        const metaLine = metaParts.length ? `<div class="small muted">${escapeHtml(metaParts.join(' · '))}</div>` : '';
        const idLine = lo.id ? `<div class="small muted">ID: ${escapeHtml(safeText(lo.id))}</div>` : '';
        return `<li><strong>${escapeHtml(safeText(lo.text))}</strong>${metaLine}${idLine}</li>`;
      })
      .join('');
    const debriefHtml = renderList(pedagogy.debrief_prompts);
    const pedagogyMeta = [
      pedagogy.performance_rubric_ref
        ? `<div class="small">Performance rubric: ${escapeHtml(safeText(pedagogy.performance_rubric_ref))}</div>`
        : '',
      Array.isArray(pedagogy.feedback_bank_keys) && pedagogy.feedback_bank_keys.length
        ? `<div class="small">Feedback bank keys: ${escapeHtml(pedagogy.feedback_bank_keys.map((k: any) => safeText(k)).join(', '))}</div>`
        : '',
    ]
      .filter(Boolean)
      .join('');
    const pedagogyContent = [
      learningObjectivesHtml ? `<ol class="learning-objectives">${learningObjectivesHtml}</ol>` : '',
      debriefHtml ? `<div class="subsection"><h3>Debrief prompts</h3>${debriefHtml}</div>` : '',
      pedagogyMeta,
    ]
      .filter(Boolean)
      .join('');

    const presenting: PresentingProblem = scenario.presenting_problem ?? {};
    const presentingRows = [
      { label: 'Primary diagnosis', value: presenting.primary_dx },
      { label: 'Onset', value: presenting.onset },
      { label: 'Onset detail', value: presenting.onset_detail },
      {
        label: 'Duration',
        value: typeof presenting.duration_weeks === 'number' ? `${presenting.duration_weeks} weeks` : '',
      },
      {
        label: 'Pain (rest)',
        value: typeof presenting.pain_nrs_rest === 'number' ? `${presenting.pain_nrs_rest}/10` : '',
      },
      {
        label: 'Pain (activity)',
        value: typeof presenting.pain_nrs_activity === 'number' ? `${presenting.pain_nrs_activity}/10` : '',
      },
      { label: '24-hour pattern', value: presenting.pattern_24h },
      {
        label: 'Red flags ruled out',
        value: typeof presenting.red_flags_ruled_out === 'boolean' ? presenting.red_flags_ruled_out : '',
      },
    ];
    const presentingDetails = renderDefinitionList(presentingRows);
    const presentingListCards: string[] = [];
    if (Array.isArray(presenting.dominant_symptoms) && presenting.dominant_symptoms.length) {
      presentingListCards.push(
        `<div class="card card--border"><h3>Dominant symptoms</h3>${renderList(presenting.dominant_symptoms)}</div>`
      );
    }
    if (Array.isArray(presenting.aggravators) && presenting.aggravators.length) {
      presentingListCards.push(
        `<div class="card card--border"><h3>Aggravators</h3>${renderList(presenting.aggravators)}</div>`
      );
    }
    if (Array.isArray(presenting.easers) && presenting.easers.length) {
      presentingListCards.push(`<div class="card card--border"><h3>Easers</h3>${renderList(presenting.easers)}</div>`);
    }
    const presentingContent = [
      presentingDetails,
      presentingListCards.length ? `<div class="card-grid">${presentingListCards.join('')}</div>` : '',
    ]
      .filter(Boolean)
      .join('');

    const icf: ICF = scenario.icf ?? {};
    const icfCards: string[] = [];
    if (icf.health_condition) {
      icfCards.push(
        `<div class="card card--border"><h3>Health condition</h3><p>${escapeHtml(safeText(icf.health_condition))}</p></div>`
      );
    }
    if (Array.isArray(icf.body_functions_structures) && icf.body_functions_structures.length) {
      icfCards.push(
        `<div class="card card--border"><h3>Body functions &amp; structures</h3>${renderList(icf.body_functions_structures)}</div>`
      );
    }
    if (Array.isArray(icf.activities) && icf.activities.length) {
      icfCards.push(`<div class="card card--border"><h3>Activities</h3>${renderList(icf.activities)}</div>`);
    }
    if (Array.isArray(icf.participation) && icf.participation.length) {
      icfCards.push(`<div class="card card--border"><h3>Participation</h3>${renderList(icf.participation)}</div>`);
    }
    if (Array.isArray(icf.environmental_factors) && icf.environmental_factors.length) {
      icfCards.push(
        `<div class="card card--border"><h3>Environmental factors</h3>${renderList(icf.environmental_factors)}</div>`
      );
    }
    if (Array.isArray(icf.personal_factors) && icf.personal_factors.length) {
      icfCards.push(
        `<div class="card card--border"><h3>Personal factors</h3>${renderList(icf.personal_factors)}</div>`
      );
    }
    const icfContent = icfCards.length ? `<div class="card-grid">${icfCards.join('')}</div>` : '';

    const context: ScenarioContext = scenario.scenario_context ?? {};
    const contextCards: string[] = [];
    if (Array.isArray(context.goals) && context.goals.length) {
      contextCards.push(`<div class="card card--border"><h3>Patient goals</h3>${renderList(context.goals)}</div>`);
    }
    if (Array.isArray(context.role_impacts) && context.role_impacts.length) {
      contextCards.push(
        `<div class="card card--border"><h3>Role impacts</h3>${renderList(context.role_impacts)}</div>`
      );
    }
    if (context.environment) {
      contextCards.push(
        `<div class="card card--border"><h3>Environment</h3><p>${escapeHtml(safeText(context.environment))}</p></div>`
      );
    }
    if (context.instructor_notes) {
      contextCards.push(
        `<div class="card card--border"><h3>Instructor notes</h3><p>${escapeHtml(safeText(context.instructor_notes))}</p></div>`
      );
    }
    const contextContent = contextCards.length ? `<div class="card-grid">${contextCards.join('')}</div>` : '';

    const fluctuation: SymptomFluctuation = scenario.symptom_fluctuation ?? {};
    const fluctuationCards: string[] = [];
    if (fluctuation.with_time) {
      fluctuationCards.push(
        `<div class="card card--border"><h3>Changes over time</h3><p>${escapeHtml(safeText(fluctuation.with_time))}</p></div>`
      );
    }
    if (fluctuation.with_activity) {
      fluctuationCards.push(
        `<div class="card card--border"><h3>Changes with activity</h3><p>${escapeHtml(safeText(fluctuation.with_activity))}</p></div>`
      );
    }
    if (Array.isArray(fluctuation.during_session_examples) && fluctuation.during_session_examples.length) {
      fluctuationCards.push(
        `<div class="card card--border"><h3>During session cues</h3>${renderList(fluctuation.during_session_examples)}</div>`
      );
    }
    const fluctuationContent = fluctuationCards.length
      ? `<div class="card-grid">${fluctuationCards.join('')}</div>`
      : '';

    const scenarioGuardrails: ScenarioGuardrails = scenario.guardrails ?? {};
    const scenarioGuardItems: string[] = [];
    if (typeof scenarioGuardrails.min_age === 'number')
      scenarioGuardItems.push(`Minimum age: ${scenarioGuardrails.min_age}`);
    if (typeof scenarioGuardrails.max_age === 'number')
      scenarioGuardItems.push(`Maximum age: ${scenarioGuardrails.max_age}`);
    if (scenarioGuardrails.sex_required)
      scenarioGuardItems.push(`Required sex: ${safeText(scenarioGuardrails.sex_required)}`);
    if (scenarioGuardrails.impact_testing_unsafe) scenarioGuardItems.push('Avoid impact testing unless cleared');
    const guardrailCards: string[] = [];
    if (scenarioGuardItems.length) {
      guardrailCards.push(
        `<div class="card card--border"><h3>Scenario guardrails</h3>${renderList(scenarioGuardItems)}</div>`
      );
    }
    if (Array.isArray(scenarioGuardrails.disallow_medications) && scenarioGuardrails.disallow_medications.length) {
      guardrailCards.push(
        `<div class="card card--border"><h3>Disallowed medications</h3>${renderList(scenarioGuardrails.disallow_medications)}</div>`
      );
    }
    const objectiveGuardItems: string[] = [];
    if (objectiveGuardrails.require_explicit_physical_consent)
      objectiveGuardItems.push('Requires explicit physical consent before physical testing');
    if (objectiveGuardrails.never_volunteer_data) objectiveGuardItems.push('Never volunteer data unprompted');
    if (typeof objectiveGuardrails.fatigue_prompt_threshold === 'number') {
      objectiveGuardItems.push(`Fatigue prompt threshold: ${objectiveGuardrails.fatigue_prompt_threshold}/10`);
    }
    if (objectiveGuardItems.length) {
      guardrailCards.push(
        `<div class="card card--border"><h3>Objective guardrails</h3>${renderList(objectiveGuardItems)}</div>`
      );
    }
    {
      const deflectionIntent: string[] = [];
      // Always emphasize behavior intent over phrasing
      deflectionIntent.push('Require named test + side + positioning before giving findings');
      if (objectiveGuardrails.never_volunteer_data) deflectionIntent.push('Avoid volunteering findings unprompted');
      if (objectiveGuardrails.require_explicit_physical_consent)
        deflectionIntent.push('Obtain explicit consent before physical contact');
      if (typeof objectiveGuardrails.fatigue_prompt_threshold === 'number')
        deflectionIntent.push(`Prompt fatigue at ${objectiveGuardrails.fatigue_prompt_threshold}/10`);
      guardrailCards.push(
        `<div class="card card--border"><h3>Objective deflection intent</h3>${renderList(deflectionIntent)}</div>`
      );
    }
    const guardrailContent = guardrailCards.length ? `<div class="card-grid">${guardrailCards.join('')}</div>` : '';

    const instructions: ScenarioInstructions = scenario.instructions ?? {};
    const spInstructions = instructions.sp_instructions ?? {};
    const spInstructionRows = renderDefinitionList([
      { label: 'Affect', value: spInstructions.affect },
      { label: 'Pain behavior', value: spInstructions.pain_behavior },
    ]);
    const spCueing =
      Array.isArray(spInstructions.cueing_rules) && spInstructions.cueing_rules.length
        ? `<div><strong>Cueing rules</strong>${renderList(spInstructions.cueing_rules)}</div>`
        : '';
    const llmHooks = instructions.llm_prompt_hooks ?? {};
    const hookBlocks: string[] = [];
    if (Array.isArray(llmHooks.coaching_cues) && llmHooks.coaching_cues.length) {
      hookBlocks.push(`<div><strong>Coaching cues</strong>${renderList(llmHooks.coaching_cues)}</div>`);
    }
    if (Array.isArray(llmHooks.deflection_lines) && llmHooks.deflection_lines.length) {
      hookBlocks.push(
        `<div><strong>Deflection lines</strong>` +
          `<div class="small muted">Authoring examples — SP will improvise phrasing.</div>` +
          `${renderList(llmHooks.deflection_lines)}</div>`
      );
    }
    const instructionsCards: string[] = [];
    if (spInstructionRows || spCueing) {
      instructionsCards.push(
        `<div class="card card--border"><h3>SP instructions</h3>${[spInstructionRows, spCueing].filter(Boolean).join('')}</div>`
      );
    }
    if (hookBlocks.length) {
      instructionsCards.push(`<div class="card card--border"><h3>LLM prompt hooks</h3>${hookBlocks.join('')}</div>`);
    }
    if (instructions.authoring_notes) {
      instructionsCards.push(
        `<div class="card card--border"><h3>Authoring notes</h3><p>${escapeHtml(safeText(instructions.authoring_notes))}</p></div>`
      );
    }
    const instructionsContent = instructionsCards.length
      ? `<div class="card-grid">${instructionsCards.join('')}</div>`
      : '';

    const subjectiveCatalog: SubjectiveItem[] = scenario.subjective_catalog ?? [];
    const subjectiveItems = subjectiveCatalog
      .map(item => {
        const script = item.patient_response_script;
        const scriptParts: string[] = [];
        if (Array.isArray(script.qualitative) && script.qualitative.length) {
          scriptParts.push(`<div><strong>Qualitative</strong>${renderList(script.qualitative)}</div>`);
        }
        if (script.numeric && Object.keys(script.numeric).length) {
          scriptParts.push(`<div><strong>Numeric</strong>${renderKeyValue(script.numeric)}</div>`);
        }
        if (script.binary_flags && Object.keys(script.binary_flags).length) {
          scriptParts.push(`<div><strong>Flags</strong>${renderKeyValue(script.binary_flags)}</div>`);
        }
        const patterns =
          Array.isArray(item.patterns) && item.patterns.length
            ? `<div class="chip-wrap">${renderChips(item.patterns)}</div>`
            : '';
        const notes = item.notes ? `<div class="small muted">${escapeHtml(safeText(item.notes))}</div>` : '';
        return `<li><div class="card card--border"><div class="card-title">${escapeHtml(safeText(item.label))} <span class="muted">(${escapeHtml(safeText(item.id))})</span></div>${[patterns, ...scriptParts, notes].filter(Boolean).join('')}</div></li>`;
      })
      .join('');
    const subjectiveContent = subjectiveItems ? `<ol class="card-stack">${subjectiveItems}</ol>` : '';

    const objectiveItems = objectives
      .map((o: ObjectiveFinding) => {
        const detailRows = [
          { label: 'Region', value: o.region },
          { label: 'Preconditions', html: renderList(o.preconditions) },
          { label: 'Contraindications', html: renderList(o.contraindications) },
          { label: 'Instructions', value: o.instructions_brief },
        ];
        const detailList = renderDefinitionList(detailRows);
        const script = o.patient_output_script;
        const scriptBlocks: string[] = [];
        if (Array.isArray(script.qualitative) && script.qualitative.length) {
          scriptBlocks.push(`<div><strong>Qualitative</strong>${renderList(script.qualitative)}</div>`);
        }
        if (script.numeric && Object.keys(script.numeric).length) {
          scriptBlocks.push(`<div><strong>Numeric</strong>${renderKeyValue(script.numeric)}</div>`);
        }
        if (script.binary_flags && Object.keys(script.binary_flags).length) {
          scriptBlocks.push(`<div><strong>Flags</strong>${renderKeyValue(script.binary_flags)}</div>`);
        }
        const testGuard = o.guardrails ?? {};
        const scriptWithDeflection =
          Array.isArray(testGuard.deflection_lines) && testGuard.deflection_lines.length
            ? `<div><strong>Deflection lines</strong>${renderList(testGuard.deflection_lines)}</div>`
            : '';
        const testGuardList: string[] = [];
        if (testGuard.data_only) testGuardList.push('Provide data-only responses');
        if (testGuard.refuse_if_contraindicated) testGuardList.push('Refuse if contraindicated');
        const guardBlock = testGuardList.length
          ? `<div><strong>Guardrails</strong>${renderList(testGuardList)}</div>`
          : '';
        return `<li><div class="card card--border"><div class="card-title">${escapeHtml(safeText(o.label))} <span class="muted">(${escapeHtml(safeText(o.test_id))})</span></div>${[detailList, ...scriptBlocks, scriptWithDeflection, guardBlock].filter(Boolean).join('')}</div></li>`;
      })
      .join('');
    const objectivesContent = objectives.length
      ? `<ol class="card-stack">${objectiveItems}</ol>`
      : '<div class="muted">No objective findings defined.</div>';

    const specialsContent = specials.length
      ? `<ol class="card-stack">${specials
          .map((sq: SpecialQuestion) => {
            const blocks: string[] = [];
            if (sq.patient_cue_intent)
              blocks.push(`<div><strong>Intent</strong>: ${escapeHtml(safeText(sq.patient_cue_intent))}</div>`);
            if (Array.isArray(sq.example_phrases) && sq.example_phrases.length)
              blocks.push(
                `<div><strong>Example phrases</strong>` +
                  `<div class="small muted">Authoring examples — SP will use natural phrasing.</div>` +
                  `${renderList(sq.example_phrases)}</div>`
              );
            if (Array.isArray(sq.delivery_guidelines) && sq.delivery_guidelines.length)
              blocks.push(`<div><strong>Delivery guidelines</strong>${renderList(sq.delivery_guidelines)}</div>`);
            if (sq.instructor_imaging_note)
              blocks.push(
                `<div><strong>Imaging note</strong>: ${escapeHtml(safeText(sq.instructor_imaging_note))}</div>`
              );
            if (Array.isArray(sq.refs) && sq.refs.length)
              blocks.push(`<div><strong>References</strong>${renderList(sq.refs)}</div>`);
            return `<li><div class="card card--border"><div class="card-title">${escapeHtml(safeText(sq.id))} <span class="muted">(${escapeHtml(safeText(sq.region))})</span></div>${blocks.join('')}</div></li>`;
          })
          .join('')}</ol>`
      : '<div class="muted">No special questions defined.</div>';

    const challengesContent = challenges.length
      ? `<ol class="card-stack">${challenges
          .map((ch: ScreeningChallenge) => {
            const blocks: string[] = [`<div><strong>Flag</strong>: ${escapeHtml(safeText(ch.flag))}</div>`];
            if (ch.cue_intent)
              blocks.push(`<div><strong>Intent</strong>: ${escapeHtml(safeText(ch.cue_intent))}</div>`);
            if (Array.isArray(ch.example_phrases) && ch.example_phrases.length)
              blocks.push(
                `<div><strong>Example phrases</strong>` +
                  `<div class="small muted">Authoring examples — SP will use natural phrasing.</div>` +
                  `${renderList(ch.example_phrases)}</div>`
              );
            if (Array.isArray(ch.reveal_triggers) && ch.reveal_triggers.length)
              blocks.push(`<div><strong>Reveal triggers</strong>${renderList(ch.reveal_triggers)}</div>`);
            if (Array.isArray(ch.delivery_guidelines) && ch.delivery_guidelines.length)
              blocks.push(`<div><strong>Delivery guidelines</strong>${renderList(ch.delivery_guidelines)}</div>`);
            if (Array.isArray(ch.learning_objectives) && ch.learning_objectives.length)
              blocks.push(`<div><strong>Objectives</strong>${renderList(ch.learning_objectives)}</div>`);
            return `<li><div class="card card--border"><div class="card-title">${escapeHtml(safeText(ch.id))}</div>${blocks.join('')}</div></li>`;
          })
          .join('')}</ol>`
      : '<div class="muted">No screening challenges defined.</div>';

    const provenance: ScenarioProvenance = scenario.provenance ?? {};
    const provenanceBlocks: string[] = [];
    if (Array.isArray(provenance.sources) && provenance.sources.length) {
      provenanceBlocks.push(`<div><strong>Sources</strong>${renderList(provenance.sources)}</div>`);
    }
    if (Array.isArray(provenance.reviewers) && provenance.reviewers.length) {
      provenanceBlocks.push(`<div><strong>Reviewers</strong>${renderList(provenance.reviewers)}</div>`);
    }
    if (provenance.last_reviewed) {
      provenanceBlocks.push(
        `<div><strong>Last reviewed</strong>: ${escapeHtml(formatDate(provenance.last_reviewed))}</div>`
      );
    }
    const provenanceContent = provenanceBlocks.length ? provenanceBlocks.join('') : '';

    const soap: ScenarioSOAP = scenario.soap ?? {};
    const soapKeys: ScenarioSOAPKey[] = ['subjective', 'objective', 'assessment', 'plan'];
    const soapBlocks = soapKeys
      .map(key => {
        const data = soap[key];
        if (
          !data ||
          typeof data !== 'object' ||
          Array.isArray(data) ||
          !Object.keys(data as Record<string, unknown>).length
        )
          return '';
        const title = key.charAt(0).toUpperCase() + key.slice(1);
        return `<details open><summary>${title}</summary><pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre></details>`;
      })
      .filter(Boolean);
    const soapContent = soapBlocks.length ? soapBlocks.join('') : '';

  const sections: string[] = [];
    if (metaContent) sections.push(`<div class="section"><h2>Scenario Snapshot</h2>${metaContent}</div>`);
    if (pedagogyContent)
      sections.push(`<div class="section"><h2>Pedagogy &amp; Learning Objectives</h2>${pedagogyContent}</div>`);
    if (presentingContent) sections.push(`<div class="section"><h2>Presenting Problem</h2>${presentingContent}</div>`);
    if (icfContent) sections.push(`<div class="section"><h2>ICF Summary</h2>${icfContent}</div>`);
    if (contextContent) sections.push(`<div class="section"><h2>Scenario Context</h2>${contextContent}</div>`);
    if (fluctuationContent)
      sections.push(`<div class="section"><h2>Symptom fluctuation</h2>${fluctuationContent}</div>`);
    if (guardrailContent)
      sections.push(`<div class="section"><h2>Guardrails &amp; Safety</h2>${guardrailContent}</div>`);
    if (instructionsContent)
      sections.push(`<div class="section"><h2>SP Instructions &amp; Hooks</h2>${instructionsContent}</div>`);
    if (subjectiveContent)
      sections.push(
        `<div class="section"><h2>Subjective Catalog (${subjectiveCatalog.length})</h2>${subjectiveContent}</div>`
      );
    sections.push(`<div class="section"><h2>Objective Catalog (${objectives.length})</h2>${objectivesContent}</div>`);
    sections.push(`<div class="section"><h2>Special Questions (${specials.length})</h2>${specialsContent}</div>`);
    sections.push(
      `<div class="section"><h2>Screening Challenges (${challenges.length})</h2>${challengesContent}</div>`
    );
    if (gold) {
      sections.push(
        `<div class="section"><h2>Gold-standard Instructions</h2><div class="small">Injected into the model for both text and voice modes.</div><pre>${escapeHtml(gold)}</pre></div>`
      );
    }
    if (provenanceContent) sections.push(`<div class="section"><h2>Provenance</h2>${provenanceContent}</div>`);
    if (soapContent) sections.push(`<div class="section"><h2>SOAP Payload</h2>${soapContent}</div>`);

    // Optionally include a Faculty Narrative section when requested
    if (audience === 'faculty') {
      // Try to load kit-linked faculty facts
      const caseId = mapScenarioToCaseId(scenario.scenario_id);
      const kit = loadScenarioKit(caseId);
      let facultyFactsHtml = '';
      if (kit) {
        const facts = retrieveFacts(kit, { audience: 'faculty', topK: 6, maxLen: 900 });
        if (Array.isArray(facts.texts) && facts.texts.length) {
          facultyFactsHtml = `<ul class="plain-list">${facts.texts
            .map(t => `<li>${escapeHtml(safeText(t))}</li>`)
            .join('')}</ul>`;
        }
      }

      // Build a concise narrative from scenario fields as a fallback/supplement
      const presentingDx = safeText((scenario.presenting_problem ?? {}).primary_dx);
      const assessmentObj = (scenario.soap ?? ({} as any)).assessment || null;
      const planObj = (scenario.soap ?? ({} as any)).plan || null;
      const assessmentJson =
        assessmentObj && typeof assessmentObj === 'object' && Object.keys(assessmentObj).length
          ? `<pre>${escapeHtml(JSON.stringify(assessmentObj, null, 2))}</pre>`
          : '';
      const planJson =
        planObj && typeof planObj === 'object' && Object.keys(planObj).length
          ? `<pre>${escapeHtml(JSON.stringify(planObj, null, 2))}</pre>`
          : '';

      // Exam highlights from objective catalog
      const examHighlights = objectives
        .slice(0, 8)
        .map((o: ObjectiveFinding) => {
          const bullets: string[] = [];
          if (o.instructions_brief) bullets.push(`Instructions: ${safeText(o.instructions_brief)}`);
          if (
            Array.isArray(o.patient_output_script?.qualitative) &&
            o.patient_output_script?.qualitative.length
          ) {
            bullets.push(`Expected: ${safeText(o.patient_output_script.qualitative[0])}`);
          }
          const bulletsHtml = bullets.length
            ? `<ul class="plain-list">${bullets.map((b: string) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
            : '';
          return `<li><strong>${escapeHtml(safeText(o.label))}</strong>${bulletsHtml}</li>`;
        })
        .join('');
      const examHighlightsHtml = examHighlights ? `<ol class="card-stack">${examHighlights}</ol>` : '';

      // Red flags and screening from challenges
      const redFlags = challenges
        .map((ch: ScreeningChallenge) => safeText(ch.flag))
        .filter((x: string | undefined): x is string => Boolean(x));
      const redFlagsHtml = redFlags.length
        ? `<ul class="plain-list">${redFlags
            .map((f: string) => `<li>${escapeHtml(f)}</li>`)
            .join('')}</ul>`
        : '';

      const facultyBlocks = [
        presentingDx ? `<div class="subsection"><h3>Working diagnosis</h3><p>${escapeHtml(presentingDx)}</p></div>` : '',
        assessmentJson ? `<div class="subsection"><h3>Assessment (key points)</h3>${assessmentJson}</div>` : '',
        examHighlightsHtml ? `<div class="subsection"><h3>Exam highlights</h3>${examHighlightsHtml}</div>` : '',
        redFlagsHtml ? `<div class="subsection"><h3>Screening red flags</h3>${redFlagsHtml}</div>` : '',
        planJson ? `<div class="subsection"><h3>Plan &amp; rationale</h3>${planJson}</div>` : '',
        facultyFactsHtml ? `<div class="subsection"><h3>Case facts for faculty</h3>${facultyFactsHtml}</div>` : '',
      ].filter(Boolean).join('');

      if (facultyBlocks) {
        sections.unshift(`<div class="section section--faculty"><h2>Faculty Narrative (Confidential)</h2>${facultyBlocks}<div class="small muted">This section is intended for instructors and is not visible to students.</div></div>`);
      }
    }

    const overviewGrid = `<div class="grid"><div class="panel"><h2>Persona Snapshot</h2><div>${personaBlock || '—'}</div></div><div class="panel"><h2>Scenario Overview</h2><div>${scenarioSummaryBlock || '—'}</div></div></div>`;
    const sectionsHtml = sections.join('');

    // If faculty view, generate a lean narrative SOAP and snapshot page instead of the full export
    if (audience === 'faculty') {
      // Snapshot
      const snapshotRows = [
        { label: 'Scenario', value: scenario.title },
        { label: 'Student Code', value: (scenario as any).student_case_id },
        { label: 'Scenario ID', value: scenario.scenario_id },
        { label: 'Setting', value: scenario.setting },
        { label: 'Difficulty', value: scenario.difficulty },
        { label: 'Patient', value: persona.demographics?.name || persona.patient_id },
        { label: 'Age', value: persona.demographics?.age },
        { label: 'Sex', value: persona.demographics?.sex },
        { label: 'Working Dx', value: (scenario.presenting_problem ?? {}).primary_dx },
      ];
      const snapshotHtml = renderDefinitionList(snapshotRows);

      // Subjective narrative
      const pp = (scenario.presenting_problem ?? {}) as PresentingProblem;
      const subjLines: string[] = [];
      if (pp.onset) subjLines.push(`Onset: ${safeText(pp.onset)}${pp.onset_detail ? ` (${safeText(pp.onset_detail)})` : ''}`);
      if (typeof pp.duration_weeks === 'number') subjLines.push(`Duration: ${pp.duration_weeks} weeks`);
      if (Array.isArray(pp.dominant_symptoms) && pp.dominant_symptoms.length) subjLines.push(`Dominant symptoms: ${pp.dominant_symptoms.map(safeText).join(', ')}`);
      if (Array.isArray(pp.aggravators) && pp.aggravators.length) subjLines.push(`Aggravated by: ${pp.aggravators.map(safeText).join(', ')}`);
      if (Array.isArray(pp.easers) && pp.easers.length) subjLines.push(`Eased by: ${pp.easers.map(safeText).join(', ')}`);
      if (pp.pattern_24h) subjLines.push(`24h pattern: ${safeText(pp.pattern_24h)}`);
      if (typeof pp.pain_nrs_rest === 'number' || typeof pp.pain_nrs_activity === 'number') {
        const rest = typeof pp.pain_nrs_rest === 'number' ? `${pp.pain_nrs_rest}/10 at rest` : null;
        const act = typeof pp.pain_nrs_activity === 'number' ? `${pp.pain_nrs_activity}/10 with activity` : null;
        subjLines.push(`Pain: ${[rest, act].filter(Boolean).join(' · ')}`);
      }
      const goals = Array.isArray((scenario.scenario_context ?? {}).goals) ? (scenario.scenario_context as any).goals : [];
      if (goals && goals.length) subjLines.push(`Patient goals: ${goals.map(safeText).join(', ')}`);
      const subjSummaryHtml = subjLines.length
        ? `<ul class="plain-list">${subjLines.map(l => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`
        : '<div class="muted">No subjective summary available.</div>';

      // Subjective catalog grouped by common history buckets
      const subjectiveCatalog: SubjectiveItem[] = scenario.subjective_catalog ?? [];
      const categorizeSubjective = (item: SubjectiveItem): string => {
        const id = String(item.id || '').toLowerCase();
        const name = String(item.label || '').toLowerCase();
        const text = `${id} ${name}`;
        if (/pain|hpi|history|onset|duration|aggravator|easer|24h|pattern|location|behavior|severity|opqrst/i.test(text)) {
          return 'Pain/HPI';
        }
        if (/goal/i.test(text)) {
          return 'Goals';
        }
        if (/med|medication|drug|allerg|pmh|psh|surgery|comorb|condition/i.test(text)) {
          return 'PMH/PSH/Medications/Allergies';
        }
        if (/imaging|x[- ]?ray|mri|ct|ultra|prior (tx|treatment)|previous (care|therapy)/i.test(text)) {
          return 'Prior imaging/treatment';
        }
        if (/sdoh|work|job|role|caregiv|adl|sleep|stress|transport|home|environment/i.test(text)) {
          return 'Function & SDOH';
        }
        if (/system review|ros|cardio|pulmo|neuro|gi|gu|endo|psych|derm/i.test(text)) {
          return 'Systems review';
        }
        if (/red *flag|night pain|weight loss|fever|cancer|cauda|saddle|incontinence/i.test(text)) {
          return 'Red flags';
        }
        return 'Other subjective';
      };

      const subjOrder = [
        'Pain/HPI',
        'Red flags',
        'Function & SDOH',
        'PMH/PSH/Medications/Allergies',
        'Prior imaging/treatment',
        'Systems review',
        'Goals',
        'Other subjective',
      ];

      const subjGrouped: Record<string, string[]> = {};
      subjectiveCatalog.slice(0, 80).forEach(item => {
        const parts: string[] = [];
        const script = (item.patient_response_script || ({} as any)) as any;
        // Show qualitative responses (patient's actual answers)
        if (Array.isArray(script.qualitative) && script.qualitative.length) {
          const responses = script.qualitative.slice(0, 5).map(safeText).join('; ');
          parts.push(responses);
        }
        // Show numeric values (pain scales, durations, etc.)
        if (script.numeric && Object.keys(script.numeric).length) {
          const kv = Object.entries(script.numeric)
            .slice(0, 4)
            .map(([k, v]) => `${k}: ${safeText(v as any)}`);
          parts.push(kv.join(', '));
        }
        // Show positive flags
        if (script.binary_flags && Object.keys(script.binary_flags).length) {
          const flags = Object.entries(script.binary_flags)
            .filter(([, v]) => v === true || String(v).toLowerCase() === 'true')
            .map(([k]) => safeText(k));
          if (flags.length) parts.push(`Positive: ${flags.join(', ')}`);
        }
        const sub = parts.length
          ? `<ul class="plain-list">${parts.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>`
          : '';
        const itemHtml = `<li><strong>${escapeHtml(safeText(item.label))}</strong>${sub}</li>`;
        const cat = categorizeSubjective(item);
        if (!subjGrouped[cat]) subjGrouped[cat] = [];
        subjGrouped[cat].push(itemHtml);
      });

      const subjCountsLine = subjOrder
        .filter(cat => Array.isArray(subjGrouped[cat]) && subjGrouped[cat].length)
        .map(cat => `${cat} (${subjGrouped[cat].length})`)
        .join(' · ');
      const subjLegend = subjCountsLine
        ? `<div class="small muted">Subjective coverage: ${escapeHtml(subjCountsLine)}</div>`
        : '';
      const subjChipsHtml = subjCountsLine
        ? `<div class="chip-row">${subjCountsLine
            .split(' · ')
            .map(seg => `<span class="chip">${escapeHtml(seg)}</span>`)
            .join('')}</div>`
        : '';
      const subjGroupedSections = subjOrder
        .filter(cat => Array.isArray(subjGrouped[cat]) && subjGrouped[cat].length)
        .map(cat => {
          return `<div class="subsection"><h3>${escapeHtml(cat)}</h3><ul class="plain-list">${subjGrouped[cat].join('')}</ul></div>`;
        })
        .join('');
      const subjHtml = `${subjSummaryHtml}${subjLegend}${subjGroupedSections}`;

      // Objective section grouped by common exam categories (observations, functional, ROM, strength, special tests, neuro, etc.)
      const categorizeObjective = (o: ObjectiveFinding): string => {
        const id = String(o.test_id || '').toLowerCase();
        const name = String(o.label || '').toLowerCase();
        const text = `${id} ${name}`;
        // Neuro
        if (/neuro|myotome|dermatome|reflex|sensation|hoffmann|babinski|slump|slr|ulsnt|neural/i.test(text)) {
          return 'Neurological';
        }
        // ROM
        if (
          /\brom\b|range of motion|flexion|extension|abduction|adduction|rotation|pronation|supination|dorsiflex|plantarflex/i.test(
            text
          )
        ) {
          return 'Range of motion';
        }
        // Strength
        if (/strength|mmt|resisted|isometric|dynamometer|grip/i.test(text)) {
          return 'Strength';
        }
        // Joint mobility
        if (/joint mobility|accessory|glide|posterior[- ]?anterior|pa spring|arthrokinematic/i.test(text)) {
          return 'Joint mobility';
        }
        // Palpation
        if (/palpation|ttp|tenderness|edema|swelling|effusion|ecchymosis/i.test(text)) {
          return 'Observation & palpation';
        }
        // Balance
        if (/balance|y[- ]?balance|single[- ]leg balance|romberg/i.test(text)) {
          return 'Balance';
        }
        // Functional movement
        if (
          /functional|sit[- ]?to[- ]?stand|squat|step[- ]?down|lunge|hop|jump|gait|stairs|reach|lift|carry/i.test(text)
        ) {
          return 'Functional movement';
        }
        // Special tests (fallback for known names or containing 'test')
        if (
          /lachman|mcmurray|valgus|varus|thompson|hawkins|kennedy|neer|empty\s?can|drop\s?arm|apprehension|relocation|spurling|faber|faddir|ober|thomas|patellar|drawer|pivot|squeeze|talar|windlass|sulcus/i.test(
            text
          ) ||
          /\btest\b/.test(text)
        ) {
          return 'Special tests';
        }
        // Observations catch-all
        if (/observation|posture|inspection|gait/i.test(text)) {
          return 'Observation & palpation';
        }
        return 'Other';
      };

      const catOrder = [
        'Observation & palpation',
        'Functional movement',
        'Range of motion',
        'Strength',
        'Joint mobility',
        'Balance',
        'Neurological',
        'Special tests',
        'Other',
      ];

      const grouped: Record<string, string[]> = {};
      objectives.slice(0, 50).forEach((o: ObjectiveFinding) => {
        const findings: string[] = [];
        const catForItem = categorizeObjective(o);

        // Fallback: pull concrete findings if present in SOAP objective bundle
        const soapFindings: Record<string, any> | null =
          soapObjectiveFindingsByKey.get(String(o.test_id || '').toLowerCase()) ||
          soapObjectiveFindingsByKey.get(String(o.label || '').toLowerCase()) ||
          null;

        // Get all the data sources
        const qual = Array.isArray(o.patient_output_script?.qualitative)
          ? (o.patient_output_script!.qualitative as any[]).map(safeText).filter(Boolean)
          : [];
        const numeric =
          (o.patient_output_script as any)?.numeric ||
          (soapFindings &&
            Object.fromEntries(Object.entries(soapFindings).filter(([_k, v]) => typeof v === 'number'))) ||
          {};
        const bin = (o.patient_output_script as any)?.binary_flags || {};
        // Derive binary flags from soap strings like "positive"/"negative"
        if (!Object.keys(bin).length && soapFindings) {
          const derived: Record<string, boolean> = {};
          for (const [k, v] of Object.entries(soapFindings)) {
            if (typeof v === 'string') {
              const s = v.toLowerCase();
              if (/\bpositive\b/.test(s)) derived[`${k}: positive`] = true;
              if (/\bnegative\b/.test(s)) derived[`${k}: negative`] = true;
              if (/\bnormal|wnl|within normal limits\b/.test(s)) derived[`${k}: normal`] = true;
            }
          }
          if (Object.keys(derived).length) Object.assign(bin as any, derived);
        }

        // Format based on test type - show ACTUAL VALUES

        // For binary tests (special tests, etc.) - show positive/negative result
        const hasPositive = Object.entries(bin).some(
          ([k, v]) =>
            (k.toLowerCase().includes('positive') || k.toLowerCase().includes('present')) &&
            (v === true || v === 1 || String(v).toLowerCase() === 'true')
        );
        const hasNegative = Object.entries(bin).some(
          ([k, v]) =>
            (k.toLowerCase().includes('negative') || k.toLowerCase().includes('absent')) &&
            (v === true || v === 1 || String(v).toLowerCase() === 'true')
        );

        if (hasPositive) {
          findings.push('<strong style="color:#dc2626">POSITIVE</strong>');
        } else if (hasNegative) {
          findings.push('<strong style="color:#059669">Negative</strong>');
        }

        // Show numeric values with proper formatting (ROM, strength, etc.)
        const numericEntries = Object.entries(numeric);
        if (numericEntries.length > 0) {
          numericEntries.forEach(([key, value]) => {
            const k = safeText(key);
            const v = safeText(value as any);
            // Format based on common clinical measures
            if (/flexion|extension|abduction|adduction|rotation|rom/i.test(k)) {
              findings.push(`${k}: <strong>${v}°</strong>`);
            } else if (/strength|mmt|grade/i.test(k)) {
              findings.push(`${k}: <strong>${v}/5</strong>`);
            } else if (/pain|tenderness|ttp/i.test(k)) {
              findings.push(`${k}: <strong>${v}/10</strong>`);
            } else {
              findings.push(`${k}: <strong>${v}</strong>`);
            }
          });
        }

        // Show qualitative findings (descriptions). If missing, derive from SOAP findings
        if (qual.length > 0) {
          qual.forEach(q => {
            // Check if it's a "normal" or "WNL" type response
            if (/\b(normal|wnl|within normal limits|no abnormal|unremarkable|intact)\b/i.test(q)) {
              findings.push(`<em style="color:#059669">${q}</em>`);
            } else if (/\b(positive|abnormal|impaired|limited|reduced|decreased|tender|pain)\b/i.test(q)) {
              findings.push(`<em style="color:#dc2626">${q}</em>`);
            } else {
              findings.push(`<em>${q}</em>`);
            }
          });
        } else if (soapFindings) {
          for (const [k, v] of Object.entries(soapFindings)) {
            if (typeof v === 'string') {
              const text = `${k}: ${v}`;
              if (/\b(negative|normal|wnl|within normal limits)\b/i.test(v)) findings.push(`<em style=\"color:#059669\">${escapeHtml(text)}</em>`);
              else if (/\b(positive|abnormal|impaired|limited|reduced|decreased|tender|pain)\b/i.test(v)) findings.push(`<em style=\"color:#dc2626\">${escapeHtml(text)}</em>`);
              else findings.push(`<em>${escapeHtml(text)}</em>`);
            }
          }
        }

        // Show other binary flags that aren't positive/negative
        Object.entries(bin).forEach(([k, v]) => {
          if (
            !/positive|negative|present|absent/i.test(k) &&
            (v === true || v === 1 || String(v).toLowerCase() === 'true')
          ) {
            findings.push(safeText(k));
          }
        });

        // Faculty request: default special tests to Negative if not positive
        const hasRenderedNegative =
          hasNegative || findings.some(s => /Negative|within normal limits|WNL|normal/i.test(s));
        if (catForItem === 'Special tests' && !hasPositive && !hasRenderedNegative) {
          findings.push('<strong style="color:#059669">Negative</strong>');
        }

        // If no specific findings, show "no data"
        const findingsHtml =
          findings.length > 0 ? findings.join(' • ') : '<span style="color:#666">No specific values recorded</span>';

        const itemHtml = `<li><strong>${escapeHtml(safeText(o.label))}</strong><div style=\"margin-left:1.5em;margin-top:4px\">${findingsHtml}</div></li>`;
        if (!grouped[catForItem]) grouped[catForItem] = [];
        grouped[catForItem].push(itemHtml);
      });

      const objectiveCountsLine = catOrder
        .filter(cat => Array.isArray(grouped[cat]) && grouped[cat].length)
        .map(cat => `${cat} (${grouped[cat].length})`)
        .join(' · ');
      const objectiveLegend = objectiveCountsLine
        ? `<div class="small muted">Objective basics: ${escapeHtml(objectiveCountsLine)}</div>`
        : '';
      const objectiveChipsHtml = objectiveCountsLine
        ? `<div class="chip-row">${objectiveCountsLine
            .split(' · ')
            .map(seg => `<span class="chip">${escapeHtml(seg)}</span>`)
            .join('')}</div>`
        : '';
      const objectiveSections = catOrder
        .filter(cat => Array.isArray(grouped[cat]) && grouped[cat].length)
        .map(cat => {
          const items = grouped[cat].join('');
          return `<div class="subsection"><h3>${escapeHtml(cat)}</h3><ul class="plain-list">${items}</ul></div>`;
        })
        .join('');

      const objectiveHtml =
        objectiveLegend || objectiveSections
          ? objectiveLegend + objectiveSections
          : '<div class="muted">No key objective findings recorded.</div>';

      // Assessment and differentials
      const dx = safeText((scenario.presenting_problem ?? {}).primary_dx);
      let differentialsHtml = '';
      const assessmentObj = (scenario.soap ?? ({} as any)).assessment || null;
      if (assessmentObj && typeof assessmentObj === 'object') {
        const diffs = (assessmentObj as any).differentials as any;
        if (Array.isArray(diffs) && diffs.length) {
          differentialsHtml = `<div class="small"><em>Diffs:</em> ${diffs.map((d: any) => safeText(d)).join(', ')}</div>`;
        }
      }
      let assessmentHtml = '<div class="muted">No assessment recorded.</div>';
      if (dx) {
        assessmentHtml = `<p><strong>Working diagnosis:</strong> ${escapeHtml(dx)}</p>${differentialsHtml}`;
      }

      // Plan summary: flatten first-level keys into bullets
      const planObj = (scenario.soap ?? ({} as any)).plan || null;
      const planBullets: string[] = [];
      if (planObj && typeof planObj === 'object') {
        for (const [k, v] of Object.entries(planObj)) {
          const vt = typeof v === 'object' && v !== null ? JSON.stringify(v) : safeText(v as any);
          if (vt) planBullets.push(`${k}: ${vt}`);
        }
      }
      let planHtml = '<div class="muted">No initial plan recorded.</div>';
      if (planBullets.length) {
        const items = planBullets.map(b => `<li>${escapeHtml(b)}</li>`).join('');
        planHtml = `<ul class="plain-list">${items}</ul>`;
      }

      // Teaching points from pedagogy learning objectives
      const loTexts = Array.isArray(scenario.pedagogy?.learning_objectives)
        ? (scenario.pedagogy!.learning_objectives as any[]).map(lo => safeText((lo as any).text)).filter(Boolean)
        : [];
      let teachingHtml = '';
      if (loTexts.length) {
        const items = loTexts.map(t => `<li>${escapeHtml(t)}</li>`).join('');
        teachingHtml = `<ul class="plain-list">${items}</ul>`;
      }

      // Compose minimal faculty page
      const facultyHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Faculty Key · ${escapeHtml(scenario.title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root { color-scheme: light; }
        body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 24px; color: #111; background: #f6f7fb; }
    h1, h2, h3 { margin: 0 0 8px; }
    h1 { font-size: 22px; }
    h2 { font-size: 16px; margin-top: 20px; }
    .btn { display:inline-block; padding:6px 12px; background:#0d6efd; color:white; border-radius:6px; text-decoration:none; }
    .card { background: white; padding: 12px; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); margin: 10px 0; }
    .muted { color: #666; }
    .small { font-size: 12px; }
    .detail-grid { display:grid; grid-template-columns: max-content 1fr; gap: 6px 16px; }
    .detail-grid dt { font-weight: 600; }
    .detail-grid dd { margin: 0 0 6px 0; }
        .chip-row { display:flex; gap:8px; flex-wrap:wrap; margin: 4px 0 8px; }
        .chip { display:inline-block; padding:2px 8px; border-radius:999px; background:#eef2ff; color:#1e40af; border:1px solid #dbeafe; font-size:12px; }
        @media print {
          body { background: white; }
          .no-print { display:none !important; }
          .card { box-shadow: none; border: 1px solid #ddd; break-inside: avoid; page-break-inside: avoid; }
          h2 { page-break-after: avoid; }
        }
  </style>
  <script>function doPrint(){ window.print(); }</script>
  <meta name="robots" content="noindex,nofollow" />
  <meta name="description" content="Faculty Key narrative SOAP for quick case review" />
</head>
<body>
  <div class="no-print" style="margin-bottom:12px">
    <a class="btn" href="#" onclick="doPrint();return false;">Print</a>
  </div>
  <h1>Faculty Key: Case Snapshot & Narrative SOAP</h1>
  <div class="card">
    ${snapshotHtml}
  </div>
  <div class="card">
    <h2>Subjective</h2>
    <div class="small muted">Buckets: Pain/HPI, Red flags, Function &amp; SDOH, PMH/PSH/Medications/Allergies, Prior imaging/treatment, Systems review, Goals.</div>
    ${subjChipsHtml}
    ${subjHtml}
  </div>
  <div class="card">
    <h2>Objective</h2>
    <div class="small muted">Categories: Observation &amp; palpation, Functional movement, ROM, Strength, Joint mobility, Balance, Neurological, Special tests.</div>
    ${objectiveChipsHtml}
    ${objectiveHtml}
  </div>
  <div class="card">
    <h2>Assessment</h2>
    ${assessmentHtml}
  </div>
  <div class="card">
    <details>
      <summary><h2 style="display:inline">Plan</h2> <span class="small muted">(collapsed to emphasize S/O)</span></summary>
      ${planHtml}
    </details>
  </div>
  ${teachingHtml ? `<div class="card"><h2>Teaching points</h2>${teachingHtml}</div>` : ''}
  <div class="small muted">Generated at ${new Date().toLocaleString()} — Confidential, for instructors only.</div>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(facultyHtml);
    }

    // Default (student/general) full export
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>SPS Export: ${escapeHtml(scenario.title)} · ${escapeHtml(persona.demographics?.name || persona.patient_id)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root { color-scheme: light; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 24px; color: #111; background: #f6f7fb; }
    h1, h2, h3 { margin: 0 0 8px; }
    h1 { font-size: 22px; }
    h2 { font-size: 16px; margin-top: 20px; }
    h3 { font-size: 14px; margin-bottom: 8px; }
    .btn { display:inline-block; padding:6px 12px; background:#0d6efd; color:white; border-radius:6px; text-decoration:none; }
    .section--faculty { background: #fff8e1; border: 1px solid #f1d08f; padding: 12px; border-radius: 8px; }
    .muted { color: #666; }
    .small { font-size: 12px; }
  </style>
  <script>function doPrint(){ window.print(); }</script>
</head>
<body>
  <div class="no-print" style="margin-bottom:12px">
    <a class="btn" href="#" onclick="doPrint();return false;">Print</a>
  </div>
  <h1>Standardized Patient Scenario Export</h1>
  <div class="meta">Persona: ${escapeHtml(persona.demographics?.name || persona.patient_id)} · Scenario: ${escapeHtml(scenario.title)} (${escapeHtml(scenario.scenario_id)})</div>
  ${overviewGrid}
  ${sectionsHtml}
  <div class="section small">Generated at ${new Date().toLocaleString()}</div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (e) {
    console.error('[sps][export][error]', e);
    return res.status(500).send('export_error');
  }
});
