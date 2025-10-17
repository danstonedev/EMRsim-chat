import type { ClinicalScenario, PatientPersona } from '../core/types.ts';

export interface CompiledModuleArtifact {
  module_id: string;
  version: string;
  module_version: string;
  content_version: string;
  checksum: string;
  updated_at: string;
  file: string;
  data: unknown;
}

export interface CompiledPersonaArtifact {
  id: string;
  content_version: string;
  checksum: string;
  updated_at: string | null;
  file: string;
  data: PatientPersona;
}

export interface CompiledScenarioArtifact {
  schema_version: string;
  generator: string;
  compiled_at: string;
  scenario_id: string;
  content_version: string;
  manifest_checksum: string;
  dependencies_checksum: string | null;
  source_bundle: string;
  scenario: ClinicalScenario;
  persona: CompiledPersonaArtifact | null;
  modules: CompiledModuleArtifact[];
  source_files: Record<string, string | null>;
}

export interface CompiledScenarioIndexEntry {
  scenario_id: string;
  file: string;
  checksum: string;
  content_version: string;
  compiled_at: string;
  manifest_checksum: string;
  dependencies_checksum: string | null;
  persona_id: string | null;
  persona_checksum: string | null;
  modules: Array<{ module_id: string; version: string; checksum: string }>;
}

export interface CompiledScenarioIndex {
  schema_version: string;
  generated_at: string;
  generator: string;
  scenarios: Record<string, CompiledScenarioIndexEntry>;
  statistics: {
    total_scenarios: number;
    scenarios_with_persona: number;
    total_modules: number;
    total_compiled_files: number;
  };
}
