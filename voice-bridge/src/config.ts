import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const schema = z.object({
  PORT: z.string().default('3001'),
  HOST: z.string().default('0.0.0.0'),

  // ── WhatsApp ────────────────────────────────────────────────
  WHATSAPP_PHONE_NUMBER_ID: z.string(),
  WHATSAPP_ACCESS_TOKEN: z.string(),
  // Separate verify token for the calls webhook subscription
  WHATSAPP_VOICE_VERIFY_TOKEN: z.string().default('sandra-voice-verify-2026'),
  WHATSAPP_API_VERSION: z.string().default('v19.0'),

  // ── OpenAI ──────────────────────────────────────────────────
  OPENAI_API_KEY: z.string(),
  OPENAI_REALTIME_MODEL: z.string().default('gpt-4o-realtime-preview'),
  OPENAI_VOICE: z.string().default('alloy'),

  // ── Sandra persona ──────────────────────────────────────────
  SANDRA_INSTRUCTIONS: z
    .string()
    .default(
      'You are Sandra, an AI voice assistant for EdLight. ' +
        'You speak warmly and naturally on phone calls. ' +
        'Help callers with questions about EdLight programs, enrollment, coaching, and services. ' +
        'Be concise — this is a live phone call. Keep answers under 3 sentences unless more detail is truly needed. ' +
        'Never mention you are an AI unless directly asked.',
    ),

  LOG_LEVEL: z.string().default('info'),
})

export type Config = z.infer<typeof schema>
export const config = schema.parse(process.env)
