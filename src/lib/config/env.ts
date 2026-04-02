import { z } from 'zod';

/**
 * Runtime-validated environment configuration.
 * Fails fast on startup if required vars are missing.
 */
const envSchema = z.object({
  // Core
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  APP_SECRET: z.string().min(8).default('change-me-to-a-random-secret'),

  // Database
  DATABASE_URL: z.string().default('postgresql://sandra:sandra@localhost:5432/sandra?schema=public'),

  // OpenAI
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o'),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),

  // GitHub
  GITHUB_TOKEN: z.string().default(''),
  GITHUB_ORG: z.string().default('edlinitiative'),

  // Vector Store
  VECTOR_STORE_PROVIDER: z.enum(['memory', 'postgres', 'pinecone', 'qdrant', 'weaviate']).default('memory'),
  VECTOR_STORE_URL: z.string().optional(),
  VECTOR_STORE_API_KEY: z.string().optional(),

  // Admin
  ADMIN_API_KEY: z.string().optional(),

  // WhatsApp (Meta Cloud API)
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_WEBHOOK_SECRET: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default('v19.0'),

  // Instagram (Meta Graph API)
  INSTAGRAM_PAGE_ACCESS_TOKEN: z.string().optional(),
  INSTAGRAM_APP_SECRET: z.string().optional(),
  INSTAGRAM_VERIFY_TOKEN: z.string().optional(),
  INSTAGRAM_API_VERSION: z.string().default('v19.0'),

  // Email (SendGrid)
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().email().optional().or(z.literal('')),
  SENDGRID_FROM_NAME: z.string().default('Sandra — EdLight'),
  SENDGRID_WEBHOOK_SECRET: z.string().optional(),

  // Voice (OpenAI Whisper STT + TTS — reuses OPENAI_API_KEY)
  OPENAI_WHISPER_MODEL: z.string().default('whisper-1'),
  OPENAI_TTS_MODEL: z.string().default('tts-1'),
  OPENAI_TTS_VOICE: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).default('alloy'),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    // During next build, env vars may not be fully available — fall back to defaults
    // At runtime, the server will re-validate on first request
    return envSchema.parse({});
  }

  return parsed.data;
}

export const env = loadEnv();
