import express from 'express'
import { config } from './config'
import { handleVerify, handleCallWebhook } from './webhook-handler'
import { log } from './logger'

export function createServer(): express.Application {
  const app = express()

  // Parse JSON bodies for incoming webhooks
  app.use(express.json())

  // ── Health check ─────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'sandra-voice-bridge', ts: new Date().toISOString() })
  })

  // ── WhatsApp Calling API webhooks ─────────────────────────────────────────
  // Subscribe to the `calls` field in Meta's webhook settings
  // Callback URL: https://voice.edlight.org/webhook/calls
  app.get('/webhook/calls', handleVerify)
  app.post('/webhook/calls', handleCallWebhook)

  return app
}

export function startServer(): void {
  const app = createServer()
  const port = parseInt(config.PORT, 10)
  const host = config.HOST

  app.listen(port, host, () => {
    log(`[Server] Sandra Voice Bridge listening on ${host}:${port}`)
    log(`[Server] Webhook URL: https://voice.edlight.org/webhook/calls`)
    log(`[Server] Verify token: ${config.WHATSAPP_VOICE_VERIFY_TOKEN}`)
  })
}
