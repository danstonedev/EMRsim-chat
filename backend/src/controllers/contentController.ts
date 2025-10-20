import path from 'path';
import fs from 'fs';
import { Request, Response } from 'express';

// Update path constants to match new structure
const CONTENT_ROOT = path.join(__dirname, '../../sps/content');
const SCENARIOS_PATH = path.join(CONTENT_ROOT, 'scenarios/compiled');
const PERSONAS_REALTIME_PATH = path.join(CONTENT_ROOT, 'personas/realtime');
const PERSONAS_SHARED_PATH = path.join(CONTENT_ROOT, 'personas/shared');
const CHALLENGES_PATH = path.join(CONTENT_ROOT, 'banks/challenges');
const SPECIAL_QUESTIONS_PATH = path.join(CONTENT_ROOT, 'banks/special_questions');
const CATALOGS_PATH = path.join(CONTENT_ROOT, 'banks/catalogs');

// Import new normalization utilities
import { normalizePersona } from '../../sps/core/normalization';
// Import versioning utilities (Phase 4)
import { loadContentManifest, resolveContentVersion } from '../../sps/core/versioning';

export const getScenarios = async (req: Request, res: Response) => {
  try {
    // Use compiled scenarios instead of bundle sources
    const scenarioFiles = fs
      .readdirSync(SCENARIOS_PATH)
      .filter(file => file.endsWith('.json') && file !== 'index.json');

    const scenarios = scenarioFiles.map(file => {
      const scenarioData = JSON.parse(fs.readFileSync(path.join(SCENARIOS_PATH, file), 'utf8'));
      // Add version information from manifest
      const versionInfo = resolveContentVersion('scenario', scenarioData.id);
      return {
        ...scenarioData,
        content_version: versionInfo.content_version,
        checksum: versionInfo.checksum,
      };
    });

    res.json({ scenarios });
  } catch (error) {
    console.error('Error loading scenarios:', error);
    res.status(500).json({ error: 'Failed to load scenarios' });
  }
};

export const getPersonas = async (req: Request, res: Response) => {
  try {
    // Load from both realtime and shared directories
    const realtimeFiles = fs.readdirSync(PERSONAS_REALTIME_PATH).filter(file => file.endsWith('.json'));
    const sharedFiles = fs.readdirSync(PERSONAS_SHARED_PATH).filter(file => file.endsWith('.json'));

    const personas = [
      ...realtimeFiles.map(file => {
        const personaData = JSON.parse(fs.readFileSync(path.join(PERSONAS_REALTIME_PATH, file), 'utf8'));
        // Use the normalization utility instead of inline conversion
        return normalizePersona(personaData);
      }),
      ...sharedFiles.map(file => {
        const personaData = JSON.parse(fs.readFileSync(path.join(PERSONAS_SHARED_PATH, file), 'utf8'));
        // Use the normalization utility instead of inline conversion
        return normalizePersona(personaData);
      }),
    ];

    // Add version information from manifest (manifest is loaded lazily by resolver)
    const personasWithVersions = personas.map(persona => {
      const versionInfo = resolveContentVersion('persona', persona.patient_id);
      return {
        ...persona,
        content_version: versionInfo.content_version,
        checksum: versionInfo.checksum,
      };
    });

    res.json({ personas: personasWithVersions });
  } catch (error) {
    console.error('Error loading personas:', error);
    res.status(500).json({ error: 'Failed to load personas' });
  }
};

export const getChallenges = async (_req: Request, res: Response) => {
  try {
    // Updated path to challenges in the new structure
    const challengesFile = path.join(CHALLENGES_PATH, 'challenges.json');
    const challenges = JSON.parse(fs.readFileSync(challengesFile, 'utf8'));

    res.json({ challenges });
  } catch (error) {
    console.error('Error loading challenges:', error);
    res.status(500).json({ error: 'Failed to load challenges' });
  }
};

export const getSpecialQuestions = async (_req: Request, res: Response) => {
  try {
    const specialQuestionFiles = fs.readdirSync(SPECIAL_QUESTIONS_PATH).filter(file => file.endsWith('.json'));

    const specialQuestions = specialQuestionFiles.map(file => {
      return JSON.parse(fs.readFileSync(path.join(SPECIAL_QUESTIONS_PATH, file), 'utf8'));
    });

    res.json({ specialQuestions });
  } catch (error) {
    console.error('Error loading special questions:', error);
    res.status(500).json({ error: 'Failed to load special questions' });
  }
};

export const getCatalogs = async (_req: Request, res: Response) => {
  try {
    // Using the consolidated catalogs from the new path
    const catalogFiles = fs.readdirSync(CATALOGS_PATH).filter(file => file.endsWith('.library.json'));

    const catalogs = catalogFiles.map(file => {
      return JSON.parse(fs.readFileSync(path.join(CATALOGS_PATH, file), 'utf8'));
    });

    res.json({ catalogs });
  } catch (error) {
    console.error('Error loading catalogs:', error);
    res.status(500).json({ error: 'Failed to load catalogs' });
  }
};

// Add a new endpoint to expose content versioning information
export const getContentVersions = async (_req: Request, res: Response) => {
  try {
    const manifest = await loadContentManifest();
    res.json({
      version: manifest.version,
      generated_at: manifest.generated_at,
      content_versions: manifest.content,
    });
  } catch (error) {
    console.error('Error loading content manifest:', error);
    res.status(500).json({ error: 'Failed to load content version information' });
  }
};
