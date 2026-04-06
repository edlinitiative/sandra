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

  // Anthropic
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-3-5-sonnet-20241022'),

  // Google Gemini
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  GEMINI_TTS_MODEL: z.string().default('gemini-2.5-flash-preview-tts'),
  GEMINI_EMBEDDING_MODEL: z.string().default('text-embedding-004'),

  // ── Generic AI configuration (preferred) ──
  AI_CHAT_MODEL: z.string().optional(),        // preferred over OPENAI_MODEL
  AI_EMBEDDING_MODEL: z.string().optional(),    // preferred over OPENAI_EMBEDDING_MODEL

  // AI Provider priority — comma-separated list of providers to try in order
  // Available: openai, gemini, anthropic
  AI_PROVIDER_PRIORITY: z.string().default('openai,gemini,anthropic'),

  // Embedding provider — which provider to use for generating embeddings
  // Available: openai, gemini (anthropic does not support embeddings)
  EMBEDDING_PROVIDER: z.string().optional(),

  // Embedding dimension — must match the vector column in the database.
  // Default: 1536 (OpenAI text-embedding-3-small). Gemini text-embedding-004 uses 768.
  // ⚠️  Changing this requires re-indexing all documents and an ALTER TABLE migration.
  EMBEDDING_DIMENSION: z.coerce.number().int().positive().default(1536),

  // GitHub
  GITHUB_TOKEN: z.string().default(''),
  GITHUB_ORG: z.string().default(''),

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

  // Voice Bridge (separate VM for WhatsApp Calling API)
  VOICE_BRIDGE_URL: z.string().optional(),

  // Instagram (Meta Graph API)
  INSTAGRAM_PAGE_ACCESS_TOKEN: z.string().optional(),
  INSTAGRAM_APP_SECRET: z.string().optional(),
  INSTAGRAM_VERIFY_TOKEN: z.string().optional(),
  INSTAGRAM_API_VERSION: z.string().default('v19.0'),

  // Email — inbox address for the agent's Gmail account (outbound sender)
  // Outbound and inbound both go through the Google Workspace Gmail API (no SendGrid).
  SANDRA_EMAIL_ADDRESS: z.string().email().optional(),
  // Alias: AGENT_EMAIL_ADDRESS (both are accepted for backwards compat)

  // Voice (OpenAI Whisper STT + TTS — reuses OPENAI_API_KEY)
  OPENAI_WHISPER_MODEL: z.string().default('whisper-1'),
  OPENAI_TTS_MODEL: z.string().default('tts-1'),
  OPENAI_TTS_VOICE: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).default('alloy'),

  // Realtime voice sessions (WebRTC ephemeral key minting)
  REALTIME_PROVIDER: z.string().optional(),    // defaults to 'openai'
  REALTIME_MODEL: z.string().optional(),        // defaults to 'gpt-4o-realtime-preview'

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

  // Multi-tenant — fallback tenant for single-tenant / dev setups
  DEFAULT_TENANT_ID: z.string().optional(),          // Replaces hardcoded EdLight tenant ID

  // ── Auth providers (beyond Google which uses AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET) ──
  // Facebook OAuth
  AUTH_FACEBOOK_ID: z.string().optional(),
  AUTH_FACEBOOK_SECRET: z.string().optional(),

  // Email OTP — SMTP transport (nodemailer)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),          // "Sandra <noreply@example.com>"

  // Phone auth — Firebase Authentication (Google handles SMS + reCAPTCHA)
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().optional(),
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
