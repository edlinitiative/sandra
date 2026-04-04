import { Request, Response } from 'express'
import { config } from './config'
import { CallSession } from './call-session'
import { log, warn, error as logError } from './logger'

/** Active call sessions keyed by callId */
const sessions = new Map<string, CallSession>()

// ─────────────────────────────────────────────────────────────────────────────
// Webhook verification (GET)
// ─────────────────────────────────────────────────────────────────────────────

export function handleVerify(req: Request, res: Response): void {
  const mode = req.query['hub.mode'] as string
  const token = req.query['hub.verify_token'] as string
  const challenge = req.query['hub.challenge'] as string

  if (mode === 'subscribe' && token === config.WHATSAPP_VOICE_VERIFY_TOKEN) {
    log('[Webhook] Verification successful')
    res.status(200).send(challenge)
  } else {
    warn('[Webhook] Verification failed — token mismatch')
    res.sendStatus(403)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Calls webhook (POST)
// ─────────────────────────────────────────────────────────────────────────────

export function handleCallWebhook(req: Request, res: Response): void {
  // Acknowledge immediately — Meta requires < 20 s response
  res.sendStatus(200)

  // Process asynchronously
  void processCallEvent(req.body as Record<string, unknown>)
}

async function processCallEvent(body: Record<string, unknown>): Promise<void> {
  try {
    const entries = (body.entry as Array<Record<string, unknown>>) ?? []

    for (const entry of entries) {
      const changes = (entry.changes as Array<Record<string, unknown>>) ?? []

      for (const change of changes) {
        if (change.field !== 'calls') continue

        const value = change.value as Record<string, unknown>
        const calls = (value.calls as Array<Record<string, unknown>>) ?? []

        for (const call of calls) {
          await handleCallObject(call)
        }
      }
    }
  } catch (e) {
    logError('[Webhook] Error processing call event:', e)
  }
}

async function handleCallObject(call: Record<string, unknown>): Promise<void> {
  const callId = call.id as string
  const event = call.event as string

  log(`[Webhook] call_id=${callId} event=${event}`)

  switch (event) {
    case 'connect': {
      // New incoming call — start session
      const session = call.session as Record<string, unknown> | undefined
      if (!session?.sdp) {
        warn(`[Webhook] connect event missing SDP for call ${callId}`)
        return
      }

      const offerSdp = session.sdp as string
      const callerPhone = (call.from as string) ?? 'unknown'
      const callSession = new CallSession(callId, callerPhone)
      sessions.set(callId, callSession)

      try {
        await callSession.start(offerSdp)
      } catch (e) {
        logError(`[Webhook] Failed to start call ${callId}:`, e)
        sessions.delete(callId)
        // Session cleans itself up on error
      }
      break
    }

    case 'terminate': {
      // Caller hung up or call ended
      const session = sessions.get(callId)
      if (session) {
        session.onTerminate()
        sessions.delete(callId)
      } else {
        warn(`[Webhook] Terminate for unknown call ${callId}`)
      }
      break
    }

    default:
      log(`[Webhook] Unhandled call event: ${event}`)
  }
}
