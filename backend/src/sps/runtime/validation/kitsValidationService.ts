import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ScenarioKitSchema, type ScenarioKit } from '../../schemas/kit.js';

export type KitValidationLevel = 'error' | 'warning';

export interface KitValidationIssue {
  level: KitValidationLevel;
  code: string;
  message: string;
  kitId?: string;
  details?: Record<string, unknown>;
}

export interface KitValidationSummary {
  issues: KitValidationIssue[];
  errors: number;
  warnings: number;
}

export interface KitsValidationOptions {
  // Optional override for base SPS path (auto-resolved if not provided)
  spsRoot?: string;
}

function resolveSpsRoot(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const candidates = [
      path.resolve(__dirname, '..', '..'), // src/sps
      path.resolve(process.cwd(), 'src', 'sps'),
      path.resolve(process.cwd(), 'dist', 'sps'),
      path.resolve(process.cwd(), 'sps'),
    ];
    for (const c of candidates) if (fs.existsSync(c)) return c;
  } catch {
    /* ignore */
  }
  return path.resolve(process.cwd(), 'src', 'sps');
}

function toSummary(issues: KitValidationIssue[]): KitValidationSummary {
  const errors = issues.filter(i => i.level === 'error').length;
  const warnings = issues.filter(i => i.level === 'warning').length;
  return { issues, errors, warnings };
}

function issue(
  level: KitValidationLevel,
  code: string,
  message: string,
  kitId?: string,
  details?: Record<string, unknown>
): KitValidationIssue {
  return { level, code, message, kitId, details };
}

export function listKitDirs(baseDir: string): string[] {
  if (!fs.existsSync(baseDir)) return [];
  return fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => path.join(baseDir, e.name));
}

export function validateKitDir(dir: string): KitValidationSummary {
  const issues: KitValidationIssue[] = [];
  const kitPath = path.join(dir, 'kit.json');
  const kitId = path.basename(dir);

  if (!fs.existsSync(kitPath)) {
    issues.push(
      issue('error', 'KIT_FILE_MISSING', `kit.json missing in kit directory ${kitId}`, kitId, { path: kitPath })
    );
    return toSummary(issues);
  }

  let parsed: ScenarioKit | null = null;
  try {
    const raw = fs.readFileSync(kitPath, 'utf8');
    parsed = JSON.parse(raw) as ScenarioKit;
  } catch (err) {
    issues.push(
      issue('error', 'KIT_FILE_INVALID_JSON', `Failed to parse kit.json for ${kitId}: ${(err as Error).message}`, kitId)
    );
    return toSummary(issues);
  }

  const result = ScenarioKitSchema.safeParse(parsed);
  if (!result.success) {
    issues.push(
      issue('error', 'KIT_SCHEMA_INVALID', `kit.json does not match schema for ${kitId}`, kitId, {
        zodErrors: result.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      })
    );
    return toSummary(issues);
  }

  const kit = result.data;

  // Check case_id alignment with directory name
  if (kit.case_id !== kitId) {
    issues.push(
      issue(
        'warning',
        'KIT_ID_MISMATCH',
        `case_id ${kit.case_id} does not match directory name ${kitId}`,
        kit.case_id,
        { dir: kitId }
      )
    );
  }

  // Chunk id uniqueness
  const seen = new Set<string>();
  for (const ch of kit.chunks) {
    if (seen.has(ch.id)) {
      issues.push(
        issue('error', 'DUPLICATE_CHUNK_ID', `Duplicate chunk id ${ch.id} in kit ${kit.case_id}`, kit.case_id)
      );
    }
    seen.add(ch.id);

    // Audience guidance: ground truth should not be visible to students
    const isGroundTruth =
      (Array.isArray(ch.tags) && ch.tags.map(t => t.toLowerCase()).includes('ground_truth')) ||
      (typeof (ch as any).chunk_type === 'string' && (ch as any).chunk_type.toLowerCase() === 'ground_truth');
    if (isGroundTruth) {
      const audiences = Array.isArray((ch as any).audiences) ? ((ch as any).audiences as string[]) : [];
      const hasFaculty = audiences.map(a => a.toLowerCase()).includes('faculty');
      const hasStudent = audiences.map(a => a.toLowerCase()).includes('student');
      if (!audiences.length || hasStudent || !hasFaculty) {
        issues.push(
          issue(
            'warning',
            'GROUND_TRUTH_AUDIENCE_WEAK',
            `Chunk ${ch.id} marked as ground_truth should be faculty-only (audiences:["faculty"]).`,
            kit.case_id,
            { chunkId: ch.id, audiences }
          )
        );
      }
    }
  }

  return toSummary(issues);
}

export function validateAllKits(options: KitsValidationOptions = {}): KitValidationSummary {
  const issues: KitValidationIssue[] = [];
  const spsRoot = options.spsRoot ?? resolveSpsRoot();

  const kitRoots = [path.join(spsRoot, 'kits'), path.join(spsRoot, 'content', 'kits')];

  const dirs: string[] = [];
  for (const root of kitRoots) dirs.push(...listKitDirs(root));

  for (const dir of dirs) {
    const summary = validateKitDir(dir);
    issues.push(...summary.issues);
  }

  return toSummary(issues);
}
