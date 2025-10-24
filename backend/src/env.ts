import { z } from 'zod';

const envSchema = z.object({
  // Server
  PORT: z.string().default('3002').transform(Number),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // CORS
  BACKEND_CORS_ORIGINS: z.string().optional(),
  FRONTEND_URL: z.string().optional().default('http://localhost:5173'),

  // Features
  VOICE_ENABLED: z
    .string()
    .transform(val => val === 'true')
    .default('false'),
  SPS_ENABLED: z
    .string()
    .transform(val => val === 'true')
    .default('true'),
  VOICE_DEBUG: z
    .string()
    .transform(val => val === 'true')
    .default('false'),
  BANNERS_ENABLED: z
    .string()
    .transform(val => val !== 'false')
    .default('true'),

  // OpenAI Configuration
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  OPENAI_REALTIME_MODEL: z.string().default('gpt-realtime-mini-2025-10-06'),
  OPENAI_TEXT_MODEL: z.string().default('gpt-4o'),
  OPENAI_TTS_VOICE: z
    .enum(['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'])
    .default('cedar'),
  OPENAI_TRANSCRIPTION_MODEL: z.string().default('gpt-4o-mini-transcribe'),

  // Voice Activity Detection (VAD)
  REALTIME_VAD_THRESHOLD: z
    .string()
    .regex(/^\d*\.?\d+$/)
    .default('0.30')
    .transform(Number),
  REALTIME_VAD_PREFIX_MS: z.string().regex(/^\d+$/).default('300').transform(Number),
  REALTIME_VAD_SILENCE_MS: z.string().regex(/^\d+$/).default('400').transform(Number),

  // Database
  SQLITE_DB_PATH: z.string().optional(),
  DATABASE_URL: z.string().optional(),

  // Speaker Attribution (Experimental)
  SPEAKER_DIARIZATION_ENABLED: z
    .string()
    .transform(val => val === 'true')
    .default('false'),
  SPEAKER_DIARIZATION_PROVIDER: z.enum(['openai', 'azure', 'gcp', 'aws', 'pyannote', 'nemo', 'none']).default('none'),
  SPEAKER_DIARIZATION_MAX_SPEAKERS: z.string().regex(/^\d+$/).default('2').transform(Number),

  SPEAKER_ID_ENABLED: z
    .string()
    .transform(val => val === 'true')
    .default('false'),
  SPEAKER_ID_PROVIDER: z.enum(['azure_speaker', 'custom', 'none']).default('none'),
  SPEAKER_ID_THRESHOLD: z
    .string()
    .regex(/^\d*\.?\d+$/)
    .default('0.7')
    .transform(Number),

  // Optional Azure Speaker Services
  AZURE_SPEAKER_ENDPOINT: z.string().optional(),
  AZURE_SPEAKER_KEY: z.string().optional(),

  // Optional Bing Search (for AI research)
  BING_SEARCH_KEY: z.string().optional(),
  BING_SEARCH_ENDPOINT: z.string().optional().default('https://api.bing.microsoft.com/v7.0/search'),

  // Socket.IO
  BACKEND_SOCKETIO_PORT: z.string().default('3003').transform(Number),

  // Diagnostics
  HEARTBEAT_INTERVAL_MS: z.string().regex(/^\d+$/).optional().default('15000').transform(Number),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional().default('info'),
});

// Export type for use throughout the application
export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables
 * @throws {ZodError} if validation fails with detailed error messages
 */
function parseEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => {
        const path = err.path.join('.');
        return `  ❌ ${path}: ${err.message}`;
      });

      console.error('\n❌ Environment variable validation failed:\n');
      console.error(errorMessages.join('\n'));
      console.error('\n💡 Check your .env file and ensure all required variables are set.');
      console.error('📄 See .env.example for reference.\n');

      // Exit process on validation failure (fail fast)
      process.exit(1);
    }
    throw error;
  }
}

// Parse and validate on module load
export const env = parseEnv();

// Legacy config export for backward compatibility
export const config = {
  VOICE_ENABLED: env.VOICE_ENABLED,
  BANNERS_ENABLED: env.BANNERS_ENABLED,
};

// Log successful validation
console.log('✅ Environment variables validated successfully');
console.log('[env] Configuration loaded:', {
  NODE_ENV: env.NODE_ENV,
  HOST: env.HOST,
  PORT: env.PORT,
  VOICE_ENABLED: env.VOICE_ENABLED,
  SPS_ENABLED: env.SPS_ENABLED,
  BANNERS_ENABLED: env.BANNERS_ENABLED,
  OPENAI_API_KEY: env.OPENAI_API_KEY ? '***' + env.OPENAI_API_KEY.slice(-4) : 'NOT SET',
});
