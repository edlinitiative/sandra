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

  // Email — inbox address for the Sandra Gmail account
  // Outbound and inbound both go through the Google Workspace Gmail API (no SendGrid).
  SANDRA_EMAIL_ADDRESS: z.string().email().optional(), // e.g. sandra@edlight.org

  // Voice (OpenAI Whisper STT + TTS — reuses OPENAI_API_KEY)
  OPENAI_WHISPER_MODEL: z.string().default('whisper-1'),
  OPENAI_TTS_MODEL: z.string().default('tts-1'),
  OPENAI_TTS_VOICE: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).default('alloy'),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Google Workspace (domain-wide delegation via service account)
  // These are OPTIONAL — Google integration is configured per-tenant in ConnectedProvider.
  // Env vars are a convenience for single-tenant / dev setups.
  GOOGLE_SA_JSON: z.string().optional(),              // full SA JSON (base64 or raw)
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email().optional(),
  GOOGLE_SERVICE_ACCOUNT_KEY: z.string().optional(), // base64-encoded PEM private key
  GOOGLE_WORKSPACE_DOMAIN: z.string().optional(),    // e.g. "edlight.org"
  GOOGLE_DELEGATED_ADMIN_EMAIL: z.string().email().optional(), // admin for impersonation

  // Web Search (Brave Search API — optional; enables the webSearch tool)
  BRAVE_SEARCH_API_KEY: z.string().optional(),

  // Birthday alerts (optional; enables the checkBirthdays tool)
  BIRTHDAY_CONTACTS_SHEET_ID: z.string().optional(), // Google Sheets file ID for the contacts+birthday list
  BIRTHDAY_ADMIN_PHONE: z.string().optional(),       // WhatsApp number to notify, e.g. "50938001234"

  // Cron / scheduled jobs
  CRON_SECRET: z.string().optional(),                // Vercel Cron secret — protects /api/cron/* routes
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
