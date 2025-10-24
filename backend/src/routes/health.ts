import { Router, Request, Response } from 'express';
import { migrate, healthCheck, getStorageMode } from '../db.ts';

export const router = Router();

const startedAt = Date.now();
migrate();

const toBool = (value: string | undefined | null, defaultValue: boolean): boolean => {
  if (value == null) return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enable', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'disable', 'disabled'].includes(normalized)) return false;
  return defaultValue;
};

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags:
 *       - Health
 *     summary: Health check endpoint
 *     description: Returns system health status including database, OpenAI API, and feature flags
 *     responses:
 *       200:
 *         description: System health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   description: Overall health status
 *                 uptime_s:
 *                   type: integer
 *                   description: Server uptime in seconds
 *                 db:
 *                   type: string
 *                   description: Database status
 *                 openai:
 *                   type: boolean
 *                   description: OpenAI API key configured
 *                 features:
 *                   type: object
 *                   properties:
 *                     voice:
 *                       type: boolean
 *                     sps:
 *                       type: boolean
 *                     voice_debug:
 *                       type: boolean
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', (_req: Request, res: Response) => {
  let dbState = 'ok';
  try {
    dbState = healthCheck();
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'db', details: String(e) });
  }
  const openaiOk = Boolean(process.env.OPENAI_API_KEY);
  const voiceEnabled = toBool(process.env.VOICE_ENABLED ?? process.env.VITE_VOICE_ENABLED, false);
  const spsEnabled = toBool(process.env.SPS_ENABLED ?? 'true', true);
  const voiceDebug = toBool(process.env.VOICE_DEBUG ?? process.env.VITE_VOICE_DEBUG, false);
  const storageMode = getStorageMode();
  const persistenceWarning = storageMode === 'memory' ? 'using_in_memory_storage' : undefined;
  res.json({
    ok: true,
    uptime_s: Math.floor((Date.now() - startedAt) / 1000),
    db: dbState,
    openai: openaiOk ? 'ok' : 'err',
    storage: storageMode,
    warnings: persistenceWarning ? [persistenceWarning] : [],
    features: {
      voiceEnabled,
      spsEnabled,
      voiceDebug,
    },
  });
});
