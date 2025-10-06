import { Router, Request, Response } from 'express';
import { spsRegistry } from '../sps/core/registry.ts';
import { getGoldInstructions, formatPersonaSection as fmtPersona, formatScenarioSection as fmtScenario } from '../sps/runtime/sps.service.ts';
import { upsertScenario, getScenarioByIdFull, listScenariosLite } from '../db.ts';
import { zClinicalScenario } from '../sps/core/schemas.ts';
import { generateScenarioWithAI } from '../services/ai_generate.ts';
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

// Helper to generate unique scenario ID
function generateScenarioId(scenario: any): string {
  const region = scenario.region || 'unknown';
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `sc_${region}_${timestamp}_${random}`;
}

// Helper to auto-generate test IDs for objective catalog
function ensureTestIds(scenario: any): void {
  if (!Array.isArray(scenario.objective_catalog)) return;
  scenario.objective_catalog.forEach((test: any, idx: number) => {
    if (!test.test_id || test.test_id === 'new_test') {
      const label = test.label || `test_${idx}`;
      const sanitized = label.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 40);
      test.test_id = `obj_${scenario.region}_${sanitized}_${Math.random().toString(36).substring(2, 6)}`;
    }
    // Ensure region matches scenario
    test.region = scenario.region;
  });
}

// Gold standard instructions (dev/instructor aid)
router.get('/instructions', (_req: Request, res: Response) => {
  res.json({ instructions: getGoldInstructions() });
});

// Scenarios catalog (metadata only)
router.get('/scenarios', (_req: Request, res: Response) => {
  // Merge registry (file-based) and DB-backed list (lite) without duplicates; DB wins on conflicts
  try {
    const regLite = Object.values(spsRegistry.scenarios).map(s => ({
      scenario_id: s.scenario_id,
      title: s.title,
      region: s.region,
      difficulty: s.difficulty,
      setting: s.setting,
      tags: s.tags || [],
      persona_id: s.linked_persona_id || s.persona_snapshot?.id || null,
      persona_name: s.persona_snapshot?.display_name || null,
      persona_headline: s.persona_snapshot?.headline || null,
    }));
    const dbLite = listScenariosLite();
    const map = new Map();
    regLite.forEach(x => map.set(x.scenario_id, x));
    dbLite.forEach((x: any) => map.set(x.scenario_id, x));
    res.json({ scenarios: Array.from(map.values()) });
  } catch (e) {
    console.error('[sps][scenarios][error]', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Generate a scenario with AI (does not auto-save unless requested)
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { prompt, options, save } = req.body || {};
    if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'bad_request', detail: 'prompt required' });
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'no_openai_key' });

    const { scenario, sources } = await generateScenarioWithAI({ prompt, options }, req);

    if (save) {
      // upsert and add to registry for immediate availability
      upsertScenario(scenario);
      spsRegistry.addScenarios([scenario as any]);
    }
    res.status(201).json({ ok: true, scenario, sources });
  } catch (e: any) {
    if (e?.code === 'validation_error') {
      return res.status(400).json({ error: 'validation_error', issues: e.issues || [] });
    }
    if (e?.code === 'no_openai_key') {
      return res.status(503).json({ error: 'no_openai_key' });
    }
    console.error('[sps][generate][error]', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// SPS personas (distinct from legacy /api/personas set)
router.get('/personas', (_req: Request, res: Response) => {
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
router.post('/scenarios', (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    
    // Auto-generate scenario_id if missing or placeholder
    if (!body.scenario_id || body.scenario_id === 'new_scenario_id' || body.scenario_id.trim() === '') {
      body.scenario_id = generateScenarioId(body);
    }
    
    // Auto-generate test IDs and ensure regions match
    ensureTestIds(body);
    
    const scenario = zClinicalScenario.parse(body);
    // Persist to DB
    upsertScenario(scenario);
    // Update in-memory registry for immediate availability
    spsRegistry.addScenarios([scenario as any]);
    console.log('[sps][scenarios][save]', scenario.scenario_id);
    res.status(201).json({ ok: true, scenario_id: scenario.scenario_id });
  } catch (e: any) {
    if (e?.issues) {
      return res.status(400).json({ error: 'validation_error', issues: e.issues });
    }
    console.error('[sps][scenarios][save][error]', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.put('/scenarios/:id', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '');
    const body = req.body || {};
    if (!id) return res.status(400).json({ error: 'bad_request' });
    
    // Auto-generate test IDs and ensure regions match
    ensureTestIds(body);
    
    const scenario = zClinicalScenario.parse(body);
    if (scenario.scenario_id !== id) return res.status(400).json({ error: 'id_mismatch' });
    upsertScenario(scenario);
    spsRegistry.addScenarios([scenario as any]);
    console.log('[sps][scenarios][update]', id);
    res.json({ ok: true, scenario_id: id });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ error: 'validation_error', issues: e.issues });
    console.error('[sps][scenarios][update][error]', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.get('/scenarios/:id', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '');
    if (!id) return res.status(400).json({ error: 'bad_request' });
    // Prefer DB if present, otherwise fall back to registry
    const fromDb = getScenarioByIdFull(id);
    const scenario = fromDb || spsRegistry.scenarios[id] || null;
    if (!scenario) return res.status(404).json({ error: 'not_found' });
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
    if (!personaId || !scenarioId) return res.status(400).send('Missing persona_id or scenario_id');
    const persona: PatientPersona | undefined = spsRegistry.personas[personaId];
    const scenario: ClinicalScenario | undefined = spsRegistry.scenarios[scenarioId];
    if (!persona || !scenario) return res.status(404).send('Persona or scenario not found');

    const gold = getGoldInstructions()?.trim?.() || '';
    const specials = spsRegistry.getScenarioSpecials(scenario);
    const challenges = spsRegistry.getScenarioChallenges(scenario);
    const objectives: ObjectiveFinding[] = scenario.objective_catalog ?? [];
    const objectiveGuardrails: ObjectiveGuardrails = scenario.objective_guardrails ?? {};

    const escapeHtml = (s: string) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c as '&' | '<' | '>'] || c));
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
      const arr = Array.isArray(items) ? items.map((item) => safeText(item)).filter(Boolean) : [];
      return arr.length ? `<ul class="plain-list">${arr.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '';
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
      const arr = Array.isArray(items) ? items.map((item) => safeText(item)).filter(Boolean) : [];
      return arr.length ? `<div class="chip-row">${arr.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join('')}</div>` : '';
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
        if (Array.isArray(lo.capte_refs) && lo.capte_refs.length) metaParts.push(`CAPTE: ${lo.capte_refs.map((ref: any) => safeText(ref)).join(', ')}`);
        if (lo.npte_map) {
          const npteParts = [lo.npte_map.system, lo.npte_map.domain, lo.npte_map.nonsystem]
            .map((part: any) => safeText(part))
            .filter(Boolean);
          if (npteParts.length) metaParts.push(`NPTE: ${npteParts.join(' / ')}`);
        }
        if (Array.isArray(lo.assessment_focus) && lo.assessment_focus.length) metaParts.push(`Focus: ${lo.assessment_focus.map((ref: any) => safeText(ref)).join(', ')}`);
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
      presentingListCards.push(`<div class="card card--border"><h3>Dominant symptoms</h3>${renderList(presenting.dominant_symptoms)}</div>`);
    }
    if (Array.isArray(presenting.aggravators) && presenting.aggravators.length) {
      presentingListCards.push(`<div class="card card--border"><h3>Aggravators</h3>${renderList(presenting.aggravators)}</div>`);
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
      icfCards.push(`<div class="card card--border"><h3>Health condition</h3><p>${escapeHtml(safeText(icf.health_condition))}</p></div>`);
    }
    if (Array.isArray(icf.body_functions_structures) && icf.body_functions_structures.length) {
      icfCards.push(`<div class="card card--border"><h3>Body functions &amp; structures</h3>${renderList(icf.body_functions_structures)}</div>`);
    }
    if (Array.isArray(icf.activities) && icf.activities.length) {
      icfCards.push(`<div class="card card--border"><h3>Activities</h3>${renderList(icf.activities)}</div>`);
    }
    if (Array.isArray(icf.participation) && icf.participation.length) {
      icfCards.push(`<div class="card card--border"><h3>Participation</h3>${renderList(icf.participation)}</div>`);
    }
    if (Array.isArray(icf.environmental_factors) && icf.environmental_factors.length) {
      icfCards.push(`<div class="card card--border"><h3>Environmental factors</h3>${renderList(icf.environmental_factors)}</div>`);
    }
    if (Array.isArray(icf.personal_factors) && icf.personal_factors.length) {
      icfCards.push(`<div class="card card--border"><h3>Personal factors</h3>${renderList(icf.personal_factors)}</div>`);
    }
    const icfContent = icfCards.length ? `<div class="card-grid">${icfCards.join('')}</div>` : '';

    const context: ScenarioContext = scenario.scenario_context ?? {};
    const contextCards: string[] = [];
    if (Array.isArray(context.goals) && context.goals.length) {
      contextCards.push(`<div class="card card--border"><h3>Patient goals</h3>${renderList(context.goals)}</div>`);
    }
    if (Array.isArray(context.role_impacts) && context.role_impacts.length) {
      contextCards.push(`<div class="card card--border"><h3>Role impacts</h3>${renderList(context.role_impacts)}</div>`);
    }
    if (context.environment) {
      contextCards.push(`<div class="card card--border"><h3>Environment</h3><p>${escapeHtml(safeText(context.environment))}</p></div>`);
    }
    if (context.instructor_notes) {
      contextCards.push(`<div class="card card--border"><h3>Instructor notes</h3><p>${escapeHtml(safeText(context.instructor_notes))}</p></div>`);
    }
    const contextContent = contextCards.length ? `<div class="card-grid">${contextCards.join('')}</div>` : '';

    const fluctuation: SymptomFluctuation = scenario.symptom_fluctuation ?? {};
    const fluctuationCards: string[] = [];
    if (fluctuation.with_time) {
      fluctuationCards.push(`<div class="card card--border"><h3>Changes over time</h3><p>${escapeHtml(safeText(fluctuation.with_time))}</p></div>`);
    }
    if (fluctuation.with_activity) {
      fluctuationCards.push(`<div class="card card--border"><h3>Changes with activity</h3><p>${escapeHtml(safeText(fluctuation.with_activity))}</p></div>`);
    }
    if (Array.isArray(fluctuation.during_session_examples) && fluctuation.during_session_examples.length) {
      fluctuationCards.push(`<div class="card card--border"><h3>During session cues</h3>${renderList(fluctuation.during_session_examples)}</div>`);
    }
    const fluctuationContent = fluctuationCards.length ? `<div class="card-grid">${fluctuationCards.join('')}</div>` : '';

    const scenarioGuardrails: ScenarioGuardrails = scenario.guardrails ?? {};
    const scenarioGuardItems: string[] = [];
    if (typeof scenarioGuardrails.min_age === 'number') scenarioGuardItems.push(`Minimum age: ${scenarioGuardrails.min_age}`);
    if (typeof scenarioGuardrails.max_age === 'number') scenarioGuardItems.push(`Maximum age: ${scenarioGuardrails.max_age}`);
    if (scenarioGuardrails.sex_required) scenarioGuardItems.push(`Required sex: ${safeText(scenarioGuardrails.sex_required)}`);
    if (scenarioGuardrails.impact_testing_unsafe) scenarioGuardItems.push('Avoid impact testing unless cleared');
    const guardrailCards: string[] = [];
    if (scenarioGuardItems.length) {
      guardrailCards.push(`<div class="card card--border"><h3>Scenario guardrails</h3>${renderList(scenarioGuardItems)}</div>`);
    }
    if (Array.isArray(scenarioGuardrails.disallow_medications) && scenarioGuardrails.disallow_medications.length) {
      guardrailCards.push(`<div class="card card--border"><h3>Disallowed medications</h3>${renderList(scenarioGuardrails.disallow_medications)}</div>`);
    }
    const objectiveGuardItems: string[] = [];
    if (objectiveGuardrails.require_explicit_physical_consent) objectiveGuardItems.push('Requires explicit physical consent before physical testing');
    if (objectiveGuardrails.never_volunteer_data) objectiveGuardItems.push('Never volunteer data unprompted');
    if (typeof objectiveGuardrails.fatigue_prompt_threshold === 'number') {
      objectiveGuardItems.push(`Fatigue prompt threshold: ${objectiveGuardrails.fatigue_prompt_threshold}/10`);
    }
    if (objectiveGuardItems.length) {
      guardrailCards.push(`<div class="card card--border"><h3>Objective guardrails</h3>${renderList(objectiveGuardItems)}</div>`);
    }
    if (Array.isArray(objectiveGuardrails.deflection_lines) && objectiveGuardrails.deflection_lines.length) {
      guardrailCards.push(`<div class="card card--border"><h3>Deflection lines</h3>${renderList(objectiveGuardrails.deflection_lines)}</div>`);
    }
    const guardrailContent = guardrailCards.length ? `<div class="card-grid">${guardrailCards.join('')}</div>` : '';

    const instructions: ScenarioInstructions = scenario.instructions ?? {};
    const spInstructions = instructions.sp_instructions ?? {};
    const spInstructionRows = renderDefinitionList([
      { label: 'Affect', value: spInstructions.affect },
      { label: 'Pain behavior', value: spInstructions.pain_behavior },
    ]);
    const spCueing = Array.isArray(spInstructions.cueing_rules) && spInstructions.cueing_rules.length
      ? `<div><strong>Cueing rules</strong>${renderList(spInstructions.cueing_rules)}</div>`
      : '';
    const llmHooks = instructions.llm_prompt_hooks ?? {};
    const hookBlocks: string[] = [];
    if (Array.isArray(llmHooks.coaching_cues) && llmHooks.coaching_cues.length) {
      hookBlocks.push(`<div><strong>Coaching cues</strong>${renderList(llmHooks.coaching_cues)}</div>`);
    }
    if (Array.isArray(llmHooks.deflection_lines) && llmHooks.deflection_lines.length) {
      hookBlocks.push(`<div><strong>Deflection lines</strong>${renderList(llmHooks.deflection_lines)}</div>`);
    }
    const instructionsCards: string[] = [];
    if (spInstructionRows || spCueing) {
      instructionsCards.push(`<div class="card card--border"><h3>SP instructions</h3>${[spInstructionRows, spCueing].filter(Boolean).join('')}</div>`);
    }
    if (hookBlocks.length) {
      instructionsCards.push(`<div class="card card--border"><h3>LLM prompt hooks</h3>${hookBlocks.join('')}</div>`);
    }
    if (instructions.authoring_notes) {
      instructionsCards.push(`<div class="card card--border"><h3>Authoring notes</h3><p>${escapeHtml(safeText(instructions.authoring_notes))}</p></div>`);
    }
    const instructionsContent = instructionsCards.length ? `<div class="card-grid">${instructionsCards.join('')}</div>` : '';

    const subjectiveCatalog: SubjectiveItem[] = scenario.subjective_catalog ?? [];
    const subjectiveItems = subjectiveCatalog
      .map((item) => {
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
        const patterns = Array.isArray(item.patterns) && item.patterns.length ? `<div class="chip-wrap">${renderChips(item.patterns)}</div>` : '';
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
        const scriptWithDeflection = Array.isArray(testGuard.deflection_lines) && testGuard.deflection_lines.length
          ? `<div><strong>Deflection lines</strong>${renderList(testGuard.deflection_lines)}</div>`
          : '';
        const testGuardList: string[] = [];
        if (testGuard.data_only) testGuardList.push('Provide data-only responses');
        if (testGuard.refuse_if_contraindicated) testGuardList.push('Refuse if contraindicated');
        const guardBlock = testGuardList.length ? `<div><strong>Guardrails</strong>${renderList(testGuardList)}</div>` : '';
        return `<li><div class="card card--border"><div class="card-title">${escapeHtml(safeText(o.label))} <span class="muted">(${escapeHtml(safeText(o.test_id))})</span></div>${[detailList, ...scriptBlocks, scriptWithDeflection, guardBlock].filter(Boolean).join('')}</div></li>`;
      })
      .join('');
    const objectivesContent = objectives.length ? `<ol class="card-stack">${objectiveItems}</ol>` : '<div class="muted">No objective findings defined.</div>';

    const specialsContent = specials.length
      ? `<ol class="card-stack">${specials
          .map((sq: SpecialQuestion) => {
            const blocks: string[] = [];
            if (sq.patient_cue_intent) blocks.push(`<div><strong>Intent</strong>: ${escapeHtml(safeText(sq.patient_cue_intent))}</div>`);
            if (Array.isArray(sq.example_phrases) && sq.example_phrases.length) blocks.push(`<div><strong>Example phrases</strong>${renderList(sq.example_phrases)}</div>`);
            if (Array.isArray(sq.delivery_guidelines) && sq.delivery_guidelines.length) blocks.push(`<div><strong>Delivery guidelines</strong>${renderList(sq.delivery_guidelines)}</div>`);
            if (sq.instructor_imaging_note) blocks.push(`<div><strong>Imaging note</strong>: ${escapeHtml(safeText(sq.instructor_imaging_note))}</div>`);
            if (Array.isArray(sq.refs) && sq.refs.length) blocks.push(`<div><strong>References</strong>${renderList(sq.refs)}</div>`);
            return `<li><div class="card card--border"><div class="card-title">${escapeHtml(safeText(sq.id))} <span class="muted">(${escapeHtml(safeText(sq.region))})</span></div>${blocks.join('')}</div></li>`;
          })
          .join('')}</ol>`
      : '<div class="muted">No special questions defined.</div>';

    const challengesContent = challenges.length
      ? `<ol class="card-stack">${challenges
          .map((ch: ScreeningChallenge) => {
            const blocks: string[] = [`<div><strong>Flag</strong>: ${escapeHtml(safeText(ch.flag))}</div>`];
            if (ch.cue_intent) blocks.push(`<div><strong>Intent</strong>: ${escapeHtml(safeText(ch.cue_intent))}</div>`);
            if (Array.isArray(ch.example_phrases) && ch.example_phrases.length) blocks.push(`<div><strong>Example phrases</strong>${renderList(ch.example_phrases)}</div>`);
            if (Array.isArray(ch.reveal_triggers) && ch.reveal_triggers.length) blocks.push(`<div><strong>Reveal triggers</strong>${renderList(ch.reveal_triggers)}</div>`);
            if (Array.isArray(ch.delivery_guidelines) && ch.delivery_guidelines.length) blocks.push(`<div><strong>Delivery guidelines</strong>${renderList(ch.delivery_guidelines)}</div>`);
            if (Array.isArray(ch.learning_objectives) && ch.learning_objectives.length) blocks.push(`<div><strong>Objectives</strong>${renderList(ch.learning_objectives)}</div>`);
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
      provenanceBlocks.push(`<div><strong>Last reviewed</strong>: ${escapeHtml(formatDate(provenance.last_reviewed))}</div>`);
    }
    const provenanceContent = provenanceBlocks.length ? provenanceBlocks.join('') : '';

    const soap: ScenarioSOAP = scenario.soap ?? {};
    const soapKeys: ScenarioSOAPKey[] = ['subjective', 'objective', 'assessment', 'plan'];
    const soapBlocks = soapKeys
      .map((key) => {
        const data = soap[key];
        if (!data || typeof data !== 'object' || Array.isArray(data) || !Object.keys(data as Record<string, unknown>).length) return '';
        const title = key.charAt(0).toUpperCase() + key.slice(1);
        return `<details open><summary>${title}</summary><pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre></details>`;
      })
      .filter(Boolean);
    const soapContent = soapBlocks.length ? soapBlocks.join('') : '';

    const sections: string[] = [];
    if (metaContent) sections.push(`<div class="section"><h2>Scenario Snapshot</h2>${metaContent}</div>`);
    if (pedagogyContent) sections.push(`<div class="section"><h2>Pedagogy &amp; Learning Objectives</h2>${pedagogyContent}</div>`);
    if (presentingContent) sections.push(`<div class="section"><h2>Presenting Problem</h2>${presentingContent}</div>`);
    if (icfContent) sections.push(`<div class="section"><h2>ICF Summary</h2>${icfContent}</div>`);
    if (contextContent) sections.push(`<div class="section"><h2>Scenario Context</h2>${contextContent}</div>`);
    if (fluctuationContent) sections.push(`<div class="section"><h2>Symptom fluctuation</h2>${fluctuationContent}</div>`);
    if (guardrailContent) sections.push(`<div class="section"><h2>Guardrails &amp; Safety</h2>${guardrailContent}</div>`);
    if (instructionsContent) sections.push(`<div class="section"><h2>SP Instructions &amp; Hooks</h2>${instructionsContent}</div>`);
    if (subjectiveContent) sections.push(`<div class="section"><h2>Subjective Catalog (${subjectiveCatalog.length})</h2>${subjectiveContent}</div>`);
    sections.push(`<div class="section"><h2>Objective Catalog (${objectives.length})</h2>${objectivesContent}</div>`);
    sections.push(`<div class="section"><h2>Special Questions (${specials.length})</h2>${specialsContent}</div>`);
    sections.push(`<div class="section"><h2>Screening Challenges (${challenges.length})</h2>${challengesContent}</div>`);
    if (gold) {
      sections.push(`<div class="section"><h2>Gold-standard Instructions</h2><div class="small">Injected into the model for both text and voice modes.</div><pre>${escapeHtml(gold)}</pre></div>`);
    }
    if (provenanceContent) sections.push(`<div class="section"><h2>Provenance</h2>${provenanceContent}</div>`);
    if (soapContent) sections.push(`<div class="section"><h2>SOAP Payload</h2>${soapContent}</div>`);

    const overviewGrid = `<div class="grid"><div class="panel"><h2>Persona Snapshot</h2><div>${personaBlock || '—'}</div></div><div class="panel"><h2>Scenario Overview</h2><div>${scenarioSummaryBlock || '—'}</div></div></div>`;
    const sectionsHtml = sections.join('');

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
