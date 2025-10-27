import { zClinicalScenario } from '../sps/core/schemas.js';

// Types for AI generation
interface BingSearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface SourceLite {
  title: string;
  url: string;
  snippet?: string;
}

interface FetchedSource {
  url: string;
  text: string;
}

interface GenerateOptions {
  region?: string;
  difficulty?: string;
  setting?: string;
  research?: boolean;
}

interface GenerateRequest {
  prompt: string;
  options?: GenerateOptions;
}

interface GenerateResult {
  scenario: any;
  sources: SourceLite[];
}

export function normalizeScenario(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  const normalized = { ...raw } as Record<string, any>;
  const meta = normalized.meta && typeof normalized.meta === 'object' ? normalized.meta : {};

  // Strip persona payloads embedded by the model
  delete normalized.persona;
  delete normalized.persona_profile;
  delete normalized.persona_details;

  if (typeof normalized.title !== 'string' || normalized.title.trim() === '') {
    if (typeof meta.title === 'string' && meta.title.trim() !== '') {
      normalized.title = meta.title;
    }
  }

  if (typeof normalized.region !== 'string' || normalized.region.trim() === '') {
    if (typeof meta.region === 'string' && meta.region.trim() !== '') {
      normalized.region = meta.region;
    }
  }

  if (normalized.difficulty === undefined && typeof meta.difficulty === 'string') {
    normalized.difficulty = meta.difficulty;
  }

  if (normalized.setting === undefined && typeof meta.setting === 'string') {
    normalized.setting = meta.setting;
  }

  if (normalized.tags === undefined && Array.isArray(meta.tags)) {
    normalized.tags = meta.tags;
  }

  return normalized;
}

// Simple HTML to text stripper (fallback to keep deps minimal)
function stripHtml(html: string, maxLen: number = 4000): string {
  try {
    const noScripts = String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ');
    const text = noScripts
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.slice(0, maxLen);
  } catch {
    return '';
  }
}

async function bingSearch(query: string, count: number = 5): Promise<BingSearchResult[]> {
  const key = process.env.BING_SEARCH_KEY;
  if (!key) return [];
  const endpoint = process.env.BING_SEARCH_ENDPOINT || 'https://api.bing.microsoft.com/v7.0/search';
  const url = `${endpoint}?q=${encodeURIComponent(query)}&count=${count}`;
  const r = await fetch(url, { headers: { 'Ocp-Apim-Subscription-Key': key } });
  if (!r.ok) return [];
  const data = await r.json().catch(() => ({}));
  const items = data.webPages && Array.isArray(data.webPages.value) ? data.webPages.value : [];
  return items.map((it: any) => ({ title: it.name, url: it.url, snippet: it.snippet }));
}

async function fetchSources(urls: string[] = []): Promise<FetchedSource[]> {
  const out: FetchedSource[] = [];
  for (const u of urls) {
    try {
      const r = await fetch(u, { redirect: 'follow' });
      if (!r.ok) continue;
      const ct = r.headers.get('content-type') || '';
      if (!/html|text/i.test(ct)) continue;
      const html = await r.text();
      const text = stripHtml(html);
      out.push({ url: u, text });
    } catch {
      // noop: failed to fetch or parse source; skip
    }
  }
  return out;
}

function buildSystemPrompt(): string {
  return `You are an expert physical therapy educator and evidence-based standardized patient scenario author.
Generate comprehensive clinical scenarios using the Schema v3.0.0 structure.

Produce a JSON object with this EXACT structure:
{
  "scenario": {
    "schema_version": "3.0.0",
    "scenario_id": string (e.g., "sc_hip_tha_pod0_v1"),
    "version": 1,
    "status": "draft",
    "meta": {
      "title": string (concise, functional focus, e.g., "Acute THA—Anterior Approach (POD0)"),
      "region": "hip" | "knee" | "ankle_foot" | "shoulder" | "cervical_spine" | "lumbar_spine" | "thoracic_spine" | "elbow" | "wrist_hand" | "sports_trauma_general",
      "difficulty": "easy" | "moderate" | "advanced",
      "setting": "primary_care_pt" | "sports_rehab" | "post_op" | "acute" | "telehealth" | "outpatient_pt" | "sports_pt_outpatient" | "sports_medicine_outpatient" | "sports_rehab_clinic",
      "tags": string[] (e.g., ["THA", "anterior_approach", "acute_care"]),
      "profession": "physical_therapy",
      "created_at": ISO8601 timestamp,
      "updated_at": ISO8601 timestamp
    },
    "pedagogy": {
      "learning_objectives": [
        {
          "id": "lo1",
          "text": string (specific, measurable objective),
          "bloom_level": "apply" | "analyze" | "evaluate" | "create",
          "capte_refs": ["safety_screening", "evidence_based_practice", "communication_education", "documentation", "plan_of_care"],
          "npte_map": {
            "system": "musculoskeletal" | "neuromuscular" | "cardiopulmonary" | "integumentary" | "other_systems",
            "domain": "examination" | "foundations" | "interventions",
            "nonsystem": "safety" | "professional" | "equipment_devices"
          },
          "assessment_focus": ["safety", "clinical_reasoning", "patient_education"],
          "evidence_req": "CPG|systematic_review|RCT"
        }
      ] (2-4 objectives),
      "performance_rubric_ref": "pt_outpatient_core_v1",
      "feedback_bank_keys": [],
      "debrief_prompts": string[] (1-3 reflection questions)
    },
    "presenting_problem": {
      "primary_dx": string (e.g., "Primary OA s/p R THA anterior approach"),
      "onset": "acute" | "gradual" | "insidious",
      "duration_weeks": number,
      "dominant_symptoms": string[] (3-5 symptoms),
      "pain_nrs_rest": number 0-10,
      "pain_nrs_activity": number 0-10,
      "aggravators": string[] (3-5),
      "easers": string[] (2-4),
      "pattern_24h": string (describe variation),
      "red_flags_ruled_out": boolean
    },
    "icf": {
      "health_condition": string,
      "body_functions_structures": string[] (3-5 impairments),
      "activities": string[] (3-5 activity limitations),
      "participation": string[] (2-4 participation restrictions),
      "environmental_factors": string[] (2-3 barriers or facilitators),
      "personal_factors": string[] (2-3 relevant factors)
    },
    "instructions": {
      "sp_instructions": {
        "affect": "calm" | "anxious" | "frustrated" | "guarded",
        "pain_behavior": string (e.g., "grimace with end-range movement"),
        "cueing_rules": string[] (3-5 rules like "answer only what is asked")
      },
      "llm_prompt_hooks": {
        "coaching_cues": string[] (2-3 coaching tips for AI assistant),
        "deflection_lines": string[] (optional, 1-2 deflection responses)
      },
      "authoring_notes": string (optional)
    },
    "soap": {
      "subjective": {
        "chief_complaint": string (patient's words),
        "history_present_illness": {
          "mechanism": string,
          "first_onset": ISO8601 timestamp,
          "course_since_onset": "improving" | "worsening" | "fluctuating" | "stable",
          "prior_episodes": string,
          "prior_treatment_response": string[] (2-4 treatments),
          "red_flag_denials_affirmations": {
            "fever_chills": false,
            "night_pain_unrelieved": false,
            "unexplained_weight_loss": false,
            "recent_infection": false,
            "cancer_history": false,
            "neurologic_bowel_bladder_changes": false
          }
        },
        "pain": {
          "location": string[] (1-3 locations),
          "quality": string[] (2-4 descriptors),
          "irritability": "low" | "moderate" | "high",
          "nrs_rest": number 0-10,
          "nrs_activity": number 0-10,
          "nrs_best": number 0-10,
          "nrs_worst": number 0-10,
          "aggravators": string[] (3-5),
          "easers": string[] (2-4),
          "24h_pattern": string,
          "sleep_disturbance": "none" | "difficulty_falling" | "difficulty_staying" | "both"
        },
        "past_medical_history": string[] (2-4 conditions),
        "surgical_history": string[] (include current surgery if applicable),
        "medications": string[] (3-6 meds),
        "allergies": string[] (or ["NKDA"]),
        "imaging": {
          "available": boolean,
          "modality": "xray" | "mri" | "ct" | "ultrasound" | "other",
          "date": ISO8601 timestamp,
          "body_region": string,
          "summary_patient_facing": string (layman terms),
          "clinical_interpretation": string (clinical detail)
        },
        "social_history": {
          "tobacco": "never" | "former" | "current",
          "alcohol": "none" | "social" | "regular",
          "sleep_hours": number,
          "diet_notes": string,
          "work_demands": string,
          "sport_hobbies": string[]
        },
        "sdoh": {
          "home_environment": string (describe stairs, accessibility),
          "transportation": "reliable" | "limited",
          "financial_barriers": "none" | "some" | "significant",
          "caregiving_roles": string[]
        },
        "goals": string[] (3-5 patient goals),
        "systems_review": {
          "cardiovascular_pulmonary": {
            "dyspnea": boolean,
            "chest_pain": boolean,
            "orthopnea": boolean,
            "edema": boolean
          },
          "neuromuscular": {
            "dizziness": boolean,
            "falls_history": boolean,
            "headache_neck": boolean,
            "paresthesia": boolean
          },
          "integumentary": {
            "wounds": boolean,
            "rash": boolean,
            "color_changes": boolean
          },
          "other": string[]
        },
        "special_questions_region_specific": string[] (optional)
      },
      "objective": {
        "vitals": {
          "bp_mmHg": {"systolic": number, "diastolic": number},
          "hr_bpm": number,
          "rr_bpm": number,
          "spo2_percent": number,
          "temperature_c": number,
          "position": "seated" | "supine" | "standing"
        },
        "observation": {
          "skin_incisions": string[] (if applicable),
          "effusion": string,
          "ecchymosis": string,
          "other_findings": string[]
        },
        "gait": {
          "qualitative": string[] (3-5 observations),
          "assistive_device": "none" | "cane" | "crutch" | "walker" | "other",
          "surface": "clinic" | "hallway" | "uneven"
        },
        "palpation": {
          "structures_assessed": string[],
          "tenderness_grading": "none" | "mild" | "moderate" | "severe",
          "temperature_edema_skin": string[]
        },
        "rom": {
          "method": "goniometry" | "visual_estimate",
          "active": object (joint: degrees),
          "passive": object (joint: degrees),
          "end_feel": object (joint: description),
          "symptom_reproduction": object (joint: description)
        },
        "mmt_strength": {
          "method": "manual_0_to_5",
          "grades": object (muscle_action: grade),
          "pain_inhibition": object (muscle_action: boolean)
        },
        "special_tests": [
          {
            "test_template_id": string (e.g., "tmpl_faber"),
            "performed": true,
            "findings": {
              "numeric": object (optional),
              "qualitative": string[],
              "binary_flags": {"positive": boolean}
            }
          }
        ] (3-5 tests),
        "functional_tests": [
          {
            "test_template_id": string (e.g., "tmpl_tug"),
            "performed": true,
            "findings": {
              "numeric": {"time_sec": number},
              "qualitative": string[]
            }
          }
        ] (optional, 1-2 tests),
        "outcome_measures": [
          {
            "measure_id": string (e.g., "om_lefs", "om_hoos"),
            "score_raw": number,
            "score_interpretation": string
          }
        ] (1-2 measures),
        "contraindications_precautions": string[] (2-4),
        "test_session_notes": string
      },
      "assessment": {
        "problem_list": string[] (3-5 problems),
        "working_diagnoses": string[] (1-2 diagnoses),
        "clinical_impression": string (2-3 sentences),
        "irritability_severity": "low" | "moderate" | "high",
        "staging_subgrouping": string (optional),
        "prognosis": "good" | "fair" | "poor",
        "icd10_codes": string[] (1-3 codes),
        "differential_diagnoses_considered": string[] (2-4),
        "rationale_evidence_links": string[] (2-3 clinical reasoning statements)
      },
      "plan": {
        "frequency_duration": {
          "visits_per_week": number,
          "weeks": number
        },
        "referrals_imaging_requests": string[] (if applicable),
        "goals": {
          "stg_2_4_weeks": string[] (2-3 short-term goals),
          "ltg_6_12_weeks": string[] (2-3 long-term goals)
        },
        "interventions_planned": [
          {
            "intervention_id": string (e.g., "ex_strengthening", "manual_joint", "gait_training"),
            "dose": {
              "sets": number,
              "reps": number,
              "frequency_per_week": number
            },
            "progression_criteria": string[],
            "expected_response": object (define immediate, 24-48h, 2-6wk expectations)
          }
        ] (3-5 interventions),
        "patient_education": {
          "topics": string[] (3-5 education topics),
          "teach_back_confirmed": false
        },
        "safety_netting": string[] (2-3 safety instructions)
      }
    },
    "provenance": {
      "sources": [
        {
          "title": string (CPG or systematic review title),
          "identifier": string (DOI or URL),
          "level_of_evidence": "CPG" | "systematic_review" | "RCT"
        }
      ] (1-3 sources),
      "reviewers": [],
      "last_reviewed": ISO8601 timestamp
    }
  },
  "sources": [{"title": string, "url": string}] (research sources used)
}

CRITICAL RULES:
1. Respond ONLY with valid JSON (no markdown, no code fences)
2. Use EXACT enum values specified above
3. All arrays must be [] if empty, not null or strings
4. All objects must be {} if empty, not null or strings
5. Include realistic clinical values based on evidence
6. Ensure consistency: vitals match setting, ROM values are anatomically appropriate
7. Red flags should be false/ruled out unless scenario specifically includes them
8. Create 3-5 special tests and 3-5 interventions minimum
9. Link learning objectives to NPTE domains and CAPTE standards
10. Cite evidence sources in provenance section
11. Do NOT include persona, persona_snapshot, or linked_persona_id fields anywhere in the output
`;
}

function buildUserPrompt(prompt: string, opts: GenerateOptions, researchNotes: string): string {
  const lines: string[] = [];
  lines.push(`Author a comprehensive v3.0.0 standardized patient scenario for: ${prompt}`);
  if (opts?.region) lines.push(`Region: ${opts.region}`);
  if (opts?.difficulty) lines.push(`Difficulty: ${opts.difficulty}`);
  if (opts?.setting) lines.push(`Setting: ${opts.setting}`);

  lines.push('\nRequirements:');
  lines.push('- Include complete SOAP notes (Subjective, Objective, Assessment, Plan)');
  lines.push('- Add 2-4 learning objectives with NPTE/CAPTE mapping');
  lines.push('- Do NOT include any persona objects, persona snapshots, or linked_persona references');
  lines.push('- Include 3-5 special tests with expected findings');
  lines.push('- Add 3-5 evidence-based interventions with dosage');
  lines.push('- Map to ICF framework (body functions, activities, participation)');
  lines.push('- Include provenance with CPG or systematic review citations');

  if (researchNotes) {
    lines.push('\n=== RESEARCH EXCERPTS (cite in provenance.sources) ===');
    lines.push(researchNotes);
  }

  lines.push('\nReturn JSON with structure: {scenario: {...}, sources: [...]}');
  lines.push('Use current timestamp for created_at/updated_at fields.');
  return lines.join('\n');
}

export async function generateScenarioWithAI({ prompt, options = {} }: GenerateRequest): Promise<GenerateResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw Object.assign(new Error('no_openai_key'), { code: 'no_openai_key' });
  }

  let sourcesLite: SourceLite[] = [];
  let researchNotes = '';
  if (options.research) {
    try {
      const hits = await bingSearch(
        `${prompt} physical therapy clinical scenario exam findings differential management`
      );
      sourcesLite = hits.slice(0, 5);
      const fetched = await fetchSources(sourcesLite.map(s => s.url));
      const lines: string[] = [];
      fetched.forEach((f, i) => {
        const lite = sourcesLite[i];
        const head = `SOURCE ${i + 1}: ${lite?.title || ''} — ${lite?.url || f.url}`;
        lines.push(`${head}\n${f.text}`);
      });
      researchNotes = lines.join('\n\n');
    } catch {
      // ignore research errors; proceed without
    }
  }

  const system = buildSystemPrompt();
  const user = buildUserPrompt(prompt, options, researchNotes);
  const model = process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini';

  let json: any;
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    };

    // Project API keys don't need Organization ID

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.6,
        response_format: { type: 'json_object' },
      }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`openai_http_${r.status}_${txt.slice(0, 200)}`);
    }
    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content || '';
    json = JSON.parse(content);
  } catch (e) {
    throw Object.assign(new Error('openai_generate_failed'), { code: 'openai_generate_failed', detail: String(e) });
  }

  // Normalize and validate
  const scenario = json?.scenario || json;
  const normalizedScenario = normalizeScenario(scenario);
  let parsed: any;
  try {
    parsed = zClinicalScenario.parse(normalizedScenario);
  } catch (e: any) {
    // Return structured validation issues
    throw Object.assign(new Error('validation_error'), { code: 'validation_error', issues: e?.issues || [] });
  }

  // Prefer model-provided sources if present, else from search hits
  const sources =
    Array.isArray(json?.sources) && json.sources.length
      ? json.sources
          .map((s: any) => ({ title: String(s.title || ''), url: String(s.url || '') }))
          .filter((s: SourceLite) => s.url)
      : sourcesLite;

  return { scenario: parsed, sources };
}
