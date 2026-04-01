import WebSocket from 'ws'
import { config } from './config'
import { log } from './logger'

export interface RealtimeClientOptions {
  apiKey: string
  model: string
  voice: string
  instructions: string
  onAudio: (base64Chunk: string) => void
  onEnd: () => void
}

/**
 * Connects to the OpenAI Realtime API (gpt-4o-realtime-preview).
 *
 * Audio contract:
 *   - Input format:  g711_ulaw  (raw PCMU bytes, base64-encoded, 8 kHz)
 *   - Output format: g711_ulaw  (same — no transcoding needed on either leg)
 *
 * This matches exactly what Meta sends/expects in the WhatsApp WebRTC stream
 * when PCMU is negotiated as the audio codec.
 */
export class OpenAIRealtimeClient {
  private ws: WebSocket | null = null
  private readonly opts: RealtimeClientOptions
  private closed = false

  constructor(opts: RealtimeClientOptions) {
    this.opts = opts
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `wss://api.openai.com/v1/realtime?model=${this.opts.model}`

      this.ws = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${this.opts.apiKey}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      })

      const onOpen = () => {
        log('[OpenAI] WebSocket connected')
        this.sendEvent({
          type: 'session.update',
          session: {
            modalities: ['audio', 'text'],
            instructions: this.opts.instructions,
            voice: this.opts.voice,
            // Use G.711 μ-law for both directions — no transcoding required
            input_audio_format: 'g711_ulaw',
            output_audio_format: 'g711_ulaw',
            input_audio_transcription: { model: 'whisper-1' },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 600,
            },
          },
        })
        resolve()
      }

      const onError = (err: Error) => {
        log('[OpenAI] WebSocket error:', err.message)
        reject(err)
      }

      this.ws.once('open', onOpen)
      this.ws.once('error', onError)

      this.ws.on('message', (raw: WebSocket.RawData) => {
        try {
          const event = JSON.parse(raw.toString()) as Record<string, unknown>
          this.handleEvent(event)
        } catch (e) {
          log('[OpenAI] Failed to parse message:', e)
        }
      })

      this.ws.on('close', () => {
        log('[OpenAI] WebSocket closed')
        if (!this.closed) this.opts.onEnd()
      })
    })
  }

  /** Append a chunk of raw PCMU audio (base64-encoded) from the WhatsApp caller. */
  appendAudio(base64Chunk: string): void {
    this.sendEvent({
      type: 'input_audio_buffer.append',
      audio: base64Chunk,
    })
  }

  /** Commit the current input buffer and trigger a response. */
  commitAudio(): void {
    this.sendEvent({ type: 'input_audio_buffer.commit' })
    this.sendEvent({ type: 'response.create' })
  }

  close(): void {
    this.closed = true
    this.ws?.close()
  }

  private handleEvent(event: Record<string, unknown>): void {
    const type = event.type as string

    switch (type) {
      case 'session.created':
      case 'session.updated':
        log('[OpenAI] Session ready')
        break

      case 'response.audio.delta': {
        // Streaming audio delta — forward raw G.711 bytes to Meta
        const delta = event.delta as string | undefined
        if (delta) this.opts.onAudio(delta)
        break
      }

      case 'response.audio.done':
        log('[OpenAI] Audio response complete')
        break

      case 'input_audio_buffer.speech_started':
        log('[OpenAI] Speech detected')
        break

      case 'input_audio_buffer.speech_stopped':
        log('[OpenAI] Speech ended — generating response')
        break

      case 'conversation.item.input_audio_transcription.completed':
        log('[OpenAI] Transcript:', (event.transcript as string)?.slice(0, 80))
        break

      case 'error': {
        const err = event.error as Record<string, unknown> | undefined
        log('[OpenAI] Error event:', err?.message ?? JSON.stringify(event))
        break
      }

      default:
        // Suppress noisy events
        break
    }
  }

  private sendEvent(payload: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload))
    }
  }
}
