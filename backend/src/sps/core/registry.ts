import { ScreeningChallenge, SpecialQuestion, PatientPersona, ClinicalScenario, ActiveCase } from './types';
import { zScreeningChallenge, zSpecialQuestion, zPersona, zClinicalScenario } from './schemas';

type Dict<T> = Record<string, T>;
export class SPSRegistry {
  screening: Dict<ScreeningChallenge> = {};
  specials: Dict<SpecialQuestion> = {};
  personas: Dict<PatientPersona> = {};
  scenarios: Dict<ClinicalScenario> = {};

  addChallenges(items: ScreeningChallenge[]) { items.forEach(i=>{ zScreeningChallenge.parse(i); this.screening[i.id]=i; }); return this; }
  addSpecialQuestions(items: SpecialQuestion[]) { items.forEach(i=>{ zSpecialQuestion.parse(i); this.specials[i.id]=i; }); return this; }
  addPersonas(items: PatientPersona[]) { items.forEach(i=>{ zPersona.parse(i); this.personas[i.patient_id]=i; }); return this; }
  addScenarios(items: ClinicalScenario[]) { items.forEach(i=>{ zClinicalScenario.parse(i); this.scenarios[i.scenario_id]=i; }); return this; }

  getScenarioChallenges(s: ClinicalScenario) { const ids=s.screening_challenge_ids??[]; return ids.map(id=>this.screening[id]).filter(Boolean); }
  getScenarioSpecials(s: ClinicalScenario) { const ids=new Set(s.special_question_ids??[]); return Object.values(this.specials).filter(sq=>ids.has(sq.id)); }

  composeActiveCase(personaId: string, scenarioId: string): ActiveCase {
    const persona = this.personas[personaId]; const scenario = this.scenarios[scenarioId];
    if(!persona) throw new Error(`persona not found: ${personaId}`);
    if(!scenario) throw new Error(`scenario not found: ${scenarioId}`);
    const g = scenario.guardrails || {};
    if (g.min_age && persona.demographics.age < g.min_age) console.warn('Persona age < scenario min_age');
    if (g.max_age && persona.demographics.age > g.max_age) console.warn('Persona age > scenario max_age');
    if (g.sex_required && persona.demographics.sex.toLowerCase() !== g.sex_required) console.warn('Persona sex != scenario requirement');
    return { id: `${persona.patient_id}::${scenario.scenario_id}`, persona, scenario };
  }
}
export const spsRegistry = new SPSRegistry();
