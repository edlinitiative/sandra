import { RTCPeerConnection, MediaStreamTrack, RtpPacket, RtpHeader } from 'werift'
import { OpenAIRealtimeClient } from './openai-realtime'
import { preAcceptCall, acceptCall, terminateCall, sendWhatsAppMessage } from './meta-client'
import { config } from './config'
import { log, warn } from './logger'

/**
 * CallSession manages one end-to-end WhatsApp voice call.
 *
 * Audio path (no transcoding):
 *   WhatsApp caller (PCMU G.711) → Meta WebRTC → werift onReceiveRtp
 *     → raw payload → base64 → OpenAI Realtime (input g711_ulaw)
 *     → OpenAI response (output g711_ulaw) → base64 decode
 *     → RTP via localTrack.writeRtp() → werift sender → Meta WebRTC → caller
 */
export class CallSession {
  private readonly callId: string
  private readonly callerPhone: string
  private pc: RTCPeerConnection
  private openai: OpenAIRealtimeClient
  private answerSdp = ''
  private localTrack: MediaStreamTrack | null = null

  private connected = false
  private closed = false

  constructor(callId: string, callerPhone: string = 'unknown') {
    this.callId = callId
    this.callerPhone = callerPhone

    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })

    this.openai = new OpenAIRealtimeClient({
      apiKey: config.OPENAI_API_KEY,
      model: config.OPENAI_REALTIME_MODEL,
      voice: config.OPENAI_VOICE,
      instructions: config.SANDRA_INSTRUCTIONS,
      onAudio: (base64Chunk) => this.sendAudioToMeta(base64Chunk),
      onEnd: () => void this.hangup(),
      onEscalate: (args) => this.handleEscalation(args),
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Start the call session given Meta's SDP offer.
   * Order per Meta docs:
   *   1. Set remote description (Meta's SDP offer)
   *   2. Attach a local audio track to the sender
   *   3. Create SDP answer (PCMU preferred) + set local description
   *   4. Wait for ICE gathering to complete
   *   5. Pre-accept → Meta starts ICE connectivity checks
   *   6. Wait for ICE connection
   *   7. Connect OpenAI Realtime WebSocket
   *   8. Accept call → audio flows
   */
  async start(offerSdp: string): Promise<void> {
    log(`[Call ${this.callId}] Starting`)

    // 1. Set Meta's offer
    await this.pc.setRemoteDescription({ type: 'offer', sdp: offerSdp })

    // 2. Create a local (non-remote) audio track for sending AI voice back
    this.localTrack = new MediaStreamTrack({ kind: 'audio' })
    const [transceiver] = this.pc.getTransceivers()
    if (!transceiver) throw new Error('No audio transceiver in SDP offer')

    // Attach local track to the sender — writeRtp() will feed through this
    await transceiver.sender.replaceTrack(this.localTrack)

    // Hook up incoming audio (caller → OpenAI)
    transceiver.receiver.track.onReceiveRtp.subscribe((rtp: RtpPacket) => {
      if (this.connected && !this.closed) {
        this.openai.appendAudio(rtp.payload.toString('base64'))
      }
    })

    // 3. Create and set SDP answer with PCMU codec preference
    const rawAnswer = await this.pc.createAnswer()
    const pcmuSdp = negotiatePcmu(rawAnswer.sdp)
    await this.pc.setLocalDescription({ type: 'answer', sdp: pcmuSdp })

    // 4. Wait for ICE gathering
    this.answerSdp = await this.waitForIceGathering()
    log(`[Call ${this.callId}] ICE candidates gathered`)

    // 5. Pre-accept
    await preAcceptCall(this.callId, this.answerSdp)
    log(`[Call ${this.callId}] Pre-accepted`)

    // 6. Wait for ICE to connect (Meta checks our candidates)
    await this.waitForIceConnected()
    log(`[Call ${this.callId}] WebRTC ICE connected`)

    // 7. Connect OpenAI Realtime
    await this.openai.connect()
    log(`[Call ${this.callId}] OpenAI Realtime connected`)

    // 8. Accept — audio starts flowing immediately after 200 OK
    await acceptCall(this.callId, this.answerSdp)
    this.connected = true
    log(`[Call ${this.callId}] Accepted — Sandra is live`)
  }

  /** Called when Meta sends a terminate webhook (caller hung up). */
  onTerminate(): void {
    log(`[Call ${this.callId}] Terminated by caller`)
    void this.cleanup()
  }

  /** Hang up programmatically (e.g. OpenAI closed, error, timeout). */
  async hangup(): Promise<void> {
    if (this.closed) return
    log(`[Call ${this.callId}] Hanging up`)
    try { await terminateCall(this.callId) } catch (e) {
      warn(`[Call ${this.callId}] Terminate API error:`, e)
    }
    await this.cleanup()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Send OpenAI's G.711 μ-law audio back to the WhatsApp caller.
   * Packetises into standard 20 ms PCMU frames (160 bytes @ 8 kHz)
   * and injects via the local track so werift handles SRTP + ICE.
   */
  private sendAudioToMeta(base64Chunk: string): void {
    if (!this.connected || this.closed || !this.localTrack) return

    const payload = Buffer.from(base64Chunk, 'base64')
    const FRAME_BYTES = 160 // 20 ms @ 8 kHz

    for (let offset = 0; offset < payload.length; offset += FRAME_BYTES) {
      const chunk = payload.subarray(offset, Math.min(offset + FRAME_BYTES, payload.length))
      if (chunk.length === 0) break

      const header = new RtpHeader()
      header.payloadType = 0 // PCMU (G.711 μ-law)
      header.ssrc = this.localTrack.ssrc ?? 0

      const packet = new RtpPacket(header, Buffer.from(chunk))
      this.localTrack.writeRtp(packet)
    }
  }

  private waitForIceGathering(): Promise<string> {
    return new Promise((resolve) => {
      if (this.pc.iceGatheringState === 'complete') {
        resolve(this.pc.localDescription!.sdp)
        return
      }

      const done = () => {
        clearInterval(interval)
        clearTimeout(timeout)
        resolve(this.pc.localDescription?.sdp ?? '')
      }

      // Subscribe to state change events
      this.pc.iceGatheringStateChange.subscribe((state: string) => {
        if (state === 'complete') done()
      })

      // Also poll as a safety net
      const interval = setInterval(() => {
        if (this.pc.iceGatheringState === 'complete') done()
      }, 100)

      const timeout = setTimeout(() => {
        warn(`[Call ${this.callId}] ICE gathering timed out — proceeding with partial SDP`)
        done()
      }, 8000)
    })
  }

  private waitForIceConnected(): Promise<void> {
    return new Promise((resolve, reject) => {
      const isConnected = () => {
        const s = this.pc.iceConnectionState
        return s === 'connected' || s === 'completed'
      }

      if (isConnected()) { resolve(); return }

      this.pc.iceConnectionStateChange.subscribe((state: string) => {
        if (state === 'connected' || state === 'completed') {
          clearTimeout(timeout)
          resolve()
        } else if (state === 'failed') {
          clearTimeout(timeout)
          reject(new Error('ICE connection failed'))
        }
      })

      const timeout = setTimeout(() => {
        reject(new Error('ICE connection timeout (30 s)'))
      }, 30000)
    })
  }

  /**
   * Handle escalation — notify staff via WhatsApp, then hang up after
   * a short delay so Sandra can say goodbye first.
   */
  private async handleEscalation(args: { reason: string; summary: string }): Promise<void> {
    const phones = config.ESCALATION_PHONE_NUMBERS
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)

    if (phones.length === 0) {
      warn(`[Call ${this.callId}] Escalation requested but no ESCALATION_PHONE_NUMBERS configured`)
      return
    }

    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' })
    const message =
      `📞 *Call Escalation Request*\n\n` +
      `*Caller:* ${this.callerPhone}\n` +
      `*Time:* ${timestamp}\n` +
      `*Reason:* ${args.reason}\n\n` +
      `*Conversation summary:*\n${args.summary}\n\n` +
      `Please call this person back on WhatsApp.`

    for (const phone of phones) {
      try {
        await sendWhatsAppMessage(phone, message)
        log(`[Call ${this.callId}] Escalation sent to ${phone.slice(0, 4)}****`)
      } catch (e) {
        warn(`[Call ${this.callId}] Failed to send escalation to ${phone}:`, e)
      }
    }

    // Give Sandra 8 seconds to say goodbye, then hang up
    setTimeout(() => void this.hangup(), 8000)
  }

  private async cleanup(): Promise<void> {
    if (this.closed) return
    this.closed = true
    this.connected = false
    this.openai.close()
    this.pc.close()
    log(`[Call ${this.callId}] Session cleaned up`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SDP helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rewrite the audio m-line in an SDP to prefer / restrict to PCMU (payload type 0).
 *
 * This ensures:
 *   - Meta encodes audio as G.711 μ-law (8 kHz)
 *   - We can pass raw RTP payloads straight to OpenAI as g711_ulaw
 *   - No transcoding is needed on either leg
 */
function negotiatePcmu(sdp: string): string {
  const lines = sdp.split(/\r?\n/)
  const out: string[] = []
  let inAudio = false

  for (const line of lines) {
    if (line.startsWith('m=audio')) {
      inAudio = true
      // Rewrite payload type list → PCMU=0 only (keep 101 for telephone-event)
      const replaced = line.replace(
        /^(m=audio \S+ \S+) .+/,
        '$1 0 101',
      )
      out.push(replaced)
    } else if (line.startsWith('m=')) {
      inAudio = false
      out.push(line)
    } else if (inAudio) {
      if (
        line.startsWith('a=rtpmap:') ||
        line.startsWith('a=fmtp:') ||
        line.startsWith('a=rtcp-fb:')
      ) {
        // Keep only PCMU (0) and telephone-event (101) codec attribute lines
        const pt = line.match(/^a=\w+:(\d+)/)?.[1]
        if (pt === '0' || pt === '101') out.push(line)
        // Drop OPUS, G722, etc.
      } else {
        out.push(line)
      }
    } else {
      out.push(line)
    }
  }

  return out.join('\r\n')
}
