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
        'Never mention you are an AI unless directly asked. ' +
        'If the caller asks to speak with a real person, wants human help, or has a complex issue you cannot resolve, ' +
        'use the escalate_to_human function. Provide a brief summary of the conversation and the reason for escalation. ' +
        'After escalating, tell the caller someone from the team will reach out shortly, then say goodbye.',
    ),

  // ── Escalation ──────────────────────────────────────────────
  // Comma-separated list of WhatsApp phone numbers (with country code, no +)
  // that receive escalation notifications when a caller requests a human.
  ESCALATION_PHONE_NUMBERS: z.string().default(''),

  LOG_LEVEL: z.string().default('info'),
})

export type Config = z.infer<typeof schema>
export const config = schema.parse(process.env)
