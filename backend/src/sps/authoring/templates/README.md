EMR Case Master Templates v3
============================
This package contains modular JSON templates for building evidence-based, AI-populated clinical scenarios.
Designed to scale across professions (PT-first), settings (acute, primary care, outpatient, telehealth), and conditions.

Folders
- scenario/ : scenario header/meta (links to other modules)
- persona/ : standardized patient/persona template
- instructions/ : SP directions + LLM coaching hooks
- soap/ : separate files for Subjective, Objective, Assessment, Plan
- context_modules/ : setting- or population-specific add-ons (acute care, spine primary care, neuro, sports)
- catalogs/ : shared libraries (ROM norms, tests, outcomes, protocols, safety thresholds, interventions)
- rubrics/ : pedagogy rubrics & feedback banks
- governance/ : program-wide bins (NPTE/CAPTE), validation ranges, publish checklist

Usage
1) Copy templates, keep IDs stable. 
2) Your AI agent populates fields and attaches evidence in 'provenance' where applicable.
3) Scenario header links to persona/instructions/SOAP/context modules by filename or id.
