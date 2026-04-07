'use client';

/**
 * VoiceConversation — live voice chat via OpenAI Realtime API (WebRTC).
 *
 * Flow:
 *  1. POST /api/voice/realtime-session  → ephemeral key
 *  2. RTCPeerConnection + mic track + data channel
 *  3. SDP offer → POST https://api.openai.com/v1/realtime?model=…
 *  4. Remote SDP answer → connected
 *  5. Server-side VAD detects speech start/stop
 *  6. Sandra's audio streams back via the remote track
 *  7. Transcripts arrive via the data channel as JSON events
 */

import { useState, useRef, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
type SessionState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'user_speaking'
  | 'processing'
  | 'assistant_speaking'
  | 'error';

interface TranscriptEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  final?: boolean;
}

export interface VoiceConversationProps {
  sessionId?: string;
  language?: string;
  onTurn?: (userText: string, assistantText: string) => void;
  onSessionId?: (id: string) => void;
  onActiveChange?: (active: boolean) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const REALTIME_MODEL = 'gpt-4o-realtime-preview';

const VOICE_INSTRUCTIONS = `You are Sandra, the friendly voice assistant for EdLight, an organization making education free and accessible in Haiti.

EdLight has five programs: ESLP (funded 2-week summer leadership for high schoolers), Nexus (international exchange residencies for university students), Academy (free bilingual video lessons in Maths, Physics, Chemistry, Economics), Code (free coding tracks: SQL, Python, HTML, CSS, JavaScript), and Labs (digital products for mission-led organizations). EdLight News curates external scholarship listings — EdLight does NOT offer its own scholarships. Website: edlight.org.

This is a voice conversation. Be warm and conversational. Keep answers to 1-3 sentences unless the user asks for more detail. Never read bullet lists aloud — summarize naturally instead.

ENDING THE CONVERSATION: When the user says goodbye, bye, thanks that's all, I'm done, or anything that signals they want to stop — give a warm closing reply and end it with exactly the phrase "Goodbye for now!". If someone asks you about anything violent, sexually explicit, hateful, or otherwise inappropriate, politely decline and end with "Goodbye for now!". The system will close the session automatically when you say that phrase.`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function langHint(language: string | undefined): string | undefined {
  if (!language) return undefined;
  const base = language.toLowerCase().split('-')[0];
  const MAP: Record<string, string> = { ht: 'fr' };
  return MAP[base ?? ''] ?? base ?? undefined;
}

const FAREWELL_RE = /\b(bye|goodbye|good\s*bye|see\s+you|au\s*revoir|end\s+(the\s+)?(call|conversation|chat|session)|hang\s+up|i[''']m\s+(done|good|all\s+set)|that[''']?s?\s+all|no\s+more\s+questions|stop\s+(talking|the\s+(call|chat)))\b/i;
const INAPPROPRIATE_RE = /\b(porn|sex(ual)?|naked|nude|kill\s+(you|someone|people)|murder|make\s+a\s+bomb|how\s+to\s+(hack|make\s+(drugs|weapons?))|racist|slur)\b/i;

// ── Component ─────────────────────────────────────────────────────────────────
export function VoiceConversation({ onTurn, language, onActiveChange }: VoiceConversationProps) {
  const [state, setState] = useState<SessionState>('idle');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  // WebRTC refs
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Per-turn accumulation
  const assistantIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const userTextRef = useRef('');

  // Control flags
  const pendingEndRef = useRef(false);
  const endedRef = useRef(false);
  const stateRef = useRef<SessionState>('idle');

  // Keep refs fresh
  const onTurnRef = useRef(onTurn);
  useEffect(() => { onTurnRef.current = onTurn; }, [onTurn]);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Scroll transcript to bottom
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // ── Throttled transcript deltas (batch via rAF to reduce re-renders) ──────
  const deltaBufferRef = useRef<Map<string, string>>(new Map());
  const flushRafRef = useRef<number>(0);

  const flushDeltas = useCallback(() => {
    flushRafRef.current = 0;
    const buf = deltaBufferRef.current;
    if (buf.size === 0) return;
    setTranscript(prev => {
      let next = prev;
      buf.forEach((delta, id) => {
        next = next.map(e => e.id === id ? { ...e, text: e.text + delta } : e);
      });
      return next;
    });
    buf.clear();
  }, []);

  const bufferDelta = useCallback((id: string, delta: string) => {
    const existing = deltaBufferRef.current.get(id) ?? '';
    deltaBufferRef.current.set(id, existing + delta);
    if (!flushRafRef.current) {
      flushRafRef.current = requestAnimationFrame(flushDeltas);
    }
  }, [flushDeltas]);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    // Kill mic immediately
    micRef.current?.getTracks().forEach(t => { t.enabled = false; t.stop(); });
    micRef.current = null;
    // Close connections
    try { dcRef.current?.close(); } catch { /* */ }
    try { pcRef.current?.close(); } catch { /* */ }
    dcRef.current = null;
    pcRef.current = null;
    // Stop audio playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
    }
  }, []);

  // ── Send a Realtime API event ─────────────────────────────────────────────
  const sendEvent = useCallback((evt: Record<string, unknown>) => {
    if (dcRef.current?.readyState === 'open') {
      dcRef.current.send(JSON.stringify(evt));
    }
  }, []);

  // ── Mic muting — prevents Sandra's speaker output from being picked up ────
  const setMicMuted = useCallback((muted: boolean) => {
    micRef.current?.getAudioTracks().forEach(t => { t.enabled = !muted; });
  }, []);

  // ── Data channel handler (ref keeps it always-fresh) ──────────────────────
  const handleDcMessage = useRef<(raw: string) => void>(undefined);
  handleDcMessage.current = (raw: string) => {
    if (endedRef.current) return;

    let evt: Record<string, unknown>;
    try { evt = JSON.parse(raw) as Record<string, unknown>; } catch { return; }
    const type = evt.type as string;

    switch (type) {
      case 'session.created':
      case 'session.updated':
        setState('listening');
        break;

      case 'input_audio_buffer.speech_started': {
        // Ignore VAD triggers during assistant speech — this is echo/feedback
        if (stateRef.current === 'assistant_speaking') break;
        userTextRef.current = '';
        setState('user_speaking');
        const id = crypto.randomUUID();
        userIdRef.current = id;
        setTranscript(prev => [...prev, { id, role: 'user', text: '' }]);
        break;
      }

      case 'input_audio_buffer.speech_stopped':
        setState('processing');
        break;

      case 'conversation.item.input_audio_transcription.delta': {
        const delta = (evt.delta as string | undefined) ?? '';
        const uid = userIdRef.current;
        if (uid && delta) bufferDelta(uid, delta);
        break;
      }

      case 'conversation.item.input_audio_transcription.completed': {
        const text = (evt.transcript as string | undefined)?.trim() ?? '';
        if (!text) break;
        userTextRef.current = text;
        const uid = userIdRef.current;
        userIdRef.current = null;
        setTranscript(prev => {
          if (uid) return prev.map(e => e.id === uid ? { ...e, text, final: true } : e);
          return [...prev, { id: crypto.randomUUID(), role: 'user', text, final: true }];
        });
        if (FAREWELL_RE.test(text) || INAPPROPRIATE_RE.test(text)) {
          pendingEndRef.current = true;
        }
        break;
      }

      case 'response.created': {
        const id = crypto.randomUUID();
        assistantIdRef.current = id;
        setState('assistant_speaking');
        setMicMuted(true);
        setTranscript(prev => [...prev, { id, role: 'assistant', text: '' }]);
        break;
      }

      case 'response.audio_transcript.delta': {
        const delta = (evt.delta as string | undefined) ?? '';
        const aid = assistantIdRef.current;
        if (aid && delta) bufferDelta(aid, delta);
        break;
      }

      case 'response.audio_transcript.done': {
        const text = (evt.transcript as string | undefined) ?? '';
        const aid = assistantIdRef.current;
        if (aid) {
          setTranscript(prev => prev.map(e => e.id === aid ? { ...e, text, final: true } : e));
          onTurnRef.current?.(userTextRef.current, text);
        }
        if (/goodbye for now/i.test(text)) pendingEndRef.current = true;
        break;
      }

      case 'response.done':
        assistantIdRef.current = null;
        setMicMuted(false);
        if (pendingEndRef.current) {
          pendingEndRef.current = false;
          setTimeout(() => {
            if (endedRef.current) return;
            endedRef.current = true;
            cleanup();
            setState('idle');
            setTranscript([]);
          }, 1500);
        } else {
          setState('listening');
        }
        break;

      case 'error': {
        const msg = (evt.error as { message?: string } | undefined)?.message ?? 'Realtime API error';
        setError(msg);
        setState('error');
        break;
      }
    }
  };

  // ── Start ─────────────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    setError(null);
    setTranscript([]);
    pendingEndRef.current = false;
    endedRef.current = false;
    setState('connecting');

    try {
      // 1. Ephemeral key
      const tokenRes = await fetch('/api/voice/realtime-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      });
      const tokenBody = await tokenRes.json() as { client_secret?: { value: string }; error?: string };
      if (!tokenRes.ok) {
        throw new Error(tokenBody.error ?? 'Failed to create realtime session');
      }
      const ephemeralKey = tokenBody.client_secret!.value;

      // 2. Peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });
      pcRef.current = pc;

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          setError('Connection failed — please check your network and try again');
          setState('error');
          cleanup();
        }
      };

      // 3. Remote audio → <audio> element via ref
      pc.ontrack = (e) => {
        if (audioRef.current) {
          audioRef.current.srcObject = e.streams[0] ?? null;
          void audioRef.current.play().catch(() => { /* autoplay blocked */ });
        }
      };

      // 4. Microphone
      const ms = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      micRef.current = ms;
      ms.getTracks().forEach(t => pc.addTrack(t, ms));

      // 5. Data channel
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        const hint = langHint(language);
        sendEvent({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: VOICE_INSTRUCTIONS,
            voice: 'alloy',
            input_audio_transcription: {
              model: 'gpt-4o-transcribe',
              ...(hint ? { language: hint } : {}),
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.55,
              prefix_padding_ms: 300,
              silence_duration_ms: 1200,
            },
          },
        });
      };

      dc.onmessage = (e) => handleDcMessage.current?.(e.data as string);

      // 6. SDP exchange
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(
        `https://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${ephemeralKey}`, 'Content-Type': 'application/sdp' },
          body: offer.sdp,
        },
      );
      if (!sdpRes.ok) throw new Error(`WebRTC handshake failed: ${sdpRes.status}`);

      await pc.setRemoteDescription({ type: 'answer', sdp: await sdpRes.text() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start');
      setState('error');
      cleanup();
    }
  }, [language, cleanup, sendEvent]);

  // ── End ───────────────────────────────────────────────────────────────────
  const end = useCallback(() => {
    endedRef.current = true;
    setState('idle');
    setTranscript([]);
    setError(null);
    pendingEndRef.current = false;
    assistantIdRef.current = null;
    userIdRef.current = null;
    cleanup();
  }, [cleanup]);

  // ── Interrupt ─────────────────────────────────────────────────────────────
  const interrupt = useCallback(() => {
    sendEvent({ type: 'response.cancel' });
    setMicMuted(false);
  }, [sendEvent, setMicMuted]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => {
    if (flushRafRef.current) cancelAnimationFrame(flushRafRef.current);
    cleanup();
  }, [cleanup]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const isActive = !['idle', 'error'].includes(state);

  // Notify parent when voice becomes active/inactive
  const onActiveChangeRef = useRef(onActiveChange);
  onActiveChangeRef.current = onActiveChange;
  useEffect(() => {
    onActiveChangeRef.current?.(isActive);
  }, [isActive]);

  const statusText: Record<SessionState, string> = {
    idle: '',
    connecting: 'Connecting…',
    listening: 'Listening — speak freely',
    user_speaking: 'Hearing you…',
    processing: 'Thinking…',
    assistant_speaking: 'Sandra is speaking…',
    error: 'Error',
  };

  return (
    <>
      {/* Hidden audio element — Sandra's voice output */}
      <audio ref={audioRef} autoPlay className="hidden" />

      {/* ── Idle: compact start button ── */}
      {!isActive && (
        <div className="mb-2">
          <button
            onClick={() => void start()}
            disabled={state === 'connecting'}
            className="flex w-full items-center gap-3 rounded-2xl border border-outline-variant/15 bg-surface-container-low/30 px-4 py-3 text-left transition-all hover:border-outline-variant/25 hover:bg-surface-container-low active:scale-[0.99] disabled:opacity-50"
          >
            {/* Mic icon */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-container">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium text-on-surface">Talk to Sandra</span>
              <span className="ml-2 text-xs text-outline">Live voice</span>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold tracking-wider text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              LIVE
            </span>
          </button>
          {error && <p className="mt-1.5 text-center text-xs text-red-400">{error}</p>}
        </div>
      )}

      {/* ── Active voice panel — fullscreen on mobile, inline on sm+ ── */}
      {isActive && (
        <div className="fixed inset-0 z-50 flex flex-col bg-surface sm:relative sm:inset-auto sm:z-auto sm:mb-2 sm:flex-none sm:overflow-hidden sm:rounded-2xl sm:border sm:border-outline-variant/15 sm:bg-surface-container-low">
          <div
            className="flex flex-1 flex-col items-center justify-center px-6 sm:flex-none sm:px-4"
            style={{
              paddingTop: 'max(1.5rem, env(safe-area-inset-top, 0px))',
              paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 0px))',
            }}
          >
            {/* Status */}
            <p className="mb-4 text-xs font-semibold tracking-[0.2em] uppercase text-on-surface-variant sm:mb-3 sm:text-[10px]">
              {statusText[state]}
            </p>

            {/* Voice indicator — scaled up on mobile for prominence */}
            <div className="scale-[1.4] sm:scale-100">
              <VoiceIndicator state={state} />
            </div>

            {/* Live transcript */}
            {transcript.length > 0 && (
              <div className="mt-6 max-h-[35vh] w-full max-w-md overflow-y-auto rounded-xl bg-black/20 px-4 py-3 sm:mt-3 sm:max-h-28 sm:rounded-lg sm:px-3 sm:py-2">
                {transcript.map((t) => (
                  <p
                    key={t.id}
                    className={`text-sm leading-relaxed sm:text-xs ${
                      t.role === 'user'
                        ? 'text-on-surface-variant'
                        : 'text-primary'
                    } ${!t.final ? 'opacity-60' : ''}`}
                  >
                    <span className="font-semibold">
                      {t.role === 'user' ? 'You: ' : 'Sandra: '}
                    </span>
                    {t.text || '…'}
                  </p>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            )}

            {/* Controls — larger touch targets on mobile */}
            <div className="mt-6 flex gap-3 sm:mt-3 sm:gap-2">
              <button
                onClick={end}
                className="rounded-full border border-red-500/30 bg-red-500/10 px-6 py-2.5 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/20 active:scale-95 sm:px-5 sm:py-2 sm:text-xs"
              >
                End
              </button>
              {state === 'assistant_speaking' && (
                <button
                  onClick={interrupt}
                  className="rounded-full border border-outline-variant/15 px-5 py-2.5 text-sm text-on-surface-variant transition-all hover:bg-surface-container-low hover:text-on-surface active:scale-95 sm:px-4 sm:py-2 sm:text-xs"
                >
                  Skip
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── VoiceIndicator ───────────────────────────────────────────────────────────
// Pure CSS, zero canvas overhead. Soundwave bars for speaking states,
// a pulse dot for listening, a spinner for connecting/processing.
function VoiceIndicator({ state }: { state: SessionState }) {
  if (state === 'connecting' || state === 'processing') {
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container">
        <svg className="h-6 w-6 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (state === 'listening') {
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary/40 bg-surface-container">
        <div className="h-3 w-3 animate-pulse rounded-full bg-primary" />
      </div>
    );
  }

  if (state === 'user_speaking') {
    return (
      <div className="flex h-14 items-end justify-center gap-[3px]">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="w-[3px] rounded-full bg-green-400 soundwave-bar"
            style={{ height: '24px', animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>
    );
  }

  if (state === 'assistant_speaking') {
    return (
      <div className="flex h-14 items-end justify-center gap-[3px]">
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
          <div
            key={i}
            className="w-[3px] rounded-full bg-primary soundwave-bar"
            style={{ height: '24px', animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
    );
  }

  return null;
}
