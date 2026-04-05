'use client';

/**
 * VoiceConversation — live voice chat via OpenAI Realtime API (WebRTC).
 *
 * Flow:
 *  1. POST /api/voice/realtime-session  → ephemeral key (server keeps real key safe)
 *  2. Create RTCPeerConnection, add mic track, open data channel
 *  3. SDP offer → POST https://api.openai.com/v1/realtime?model=…  (with ephemeral key)
 *  4. Set remote SDP answer → WebRTC connected
 *  5. Server-side VAD detects speech start/stop automatically
 *  6. Sandra's audio streams back in real-time via the remote track
 *  7. Transcripts arrive via the data channel as JSON events
 */

import { useState, useRef, useEffect } from 'react';
import { ParticleCanvas } from '@/components/ui/particle-canvas';

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
  streaming?: boolean;
}

export interface VoiceConversationProps {
  sessionId?: string;
  language?: string;
  onTurn?: (userText: string, assistantText: string) => void;
  onSessionId?: (id: string) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const REALTIME_MODEL = 'gpt-4o-realtime-preview';

// Compact, voice-optimised Sandra identity (no markdown — it gets read aloud)
const VOICE_INSTRUCTIONS = `You are Sandra, the friendly voice assistant for EdLight, an organization making education free and accessible in Haiti.

EdLight has five programs: ESLP (funded 2-week summer leadership for high schoolers), Nexus (international exchange residencies for university students), Academy (free bilingual video lessons in Maths, Physics, Chemistry, Economics), Code (free coding tracks: SQL, Python, HTML, CSS, JavaScript), and Labs (digital products for mission-led organizations). EdLight News curates external scholarship listings — EdLight does NOT offer its own scholarships. Website: edlight.org.

This is a voice conversation. Be warm and conversational. Keep answers to 1-3 sentences unless the user asks for more detail. Never read bullet lists aloud — summarize naturally instead.

ENDING THE CONVERSATION: When the user says goodbye, bye, thanks that's all, I'm done, or anything that signals they want to stop — give a warm closing reply and end it with exactly the phrase "Goodbye for now!". If someone asks you about anything violent, sexually explicit, hateful, or otherwise inappropriate, politely decline and end with "Goodbye for now!". The system will close the session automatically when you say that phrase.`;

// ── Audio FFT singletons — survive component re-renders ──────────────────────
// createMediaElementSource can only be called once per element per AudioContext.
let _audioCtx: AudioContext | null = null;
let _analyser: AnalyserNode | null = null;
let _src: MediaElementAudioSourceNode | null = null;

// ── Helpers ───────────────────────────────────────────────────────────────────
/**
 * Remap BCP-47 codes to the closest language the transcription model supports.
 * Haitian Creole ('ht') → French ('fr'): same script, shared vocabulary,
 * prevents the model from hallucinating CJK characters.
 */
function realtimeLanguageHint(language: string | undefined): string | undefined {
  if (!language) return undefined;
  const base = language.toLowerCase().split('-')[0];
  const REMAP: Record<string, string> = { ht: 'fr' };
  return REMAP[base ?? ''] ?? base ?? undefined;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function VoiceConversation({ onTurn, language }: VoiceConversationProps) {
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Stable refs — no re-renders on change
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Per-turn accumulation
  const currentAssistantIdRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const userTurnTextRef = useRef('');

  // Signals that the session should close after the current response finishes
  const pendingEndRef = useRef(false);

  // Audio FFT canvas
  const vizCanvasRef = useRef<HTMLCanvasElement>(null);
  const vizRafRef = useRef<number>(0);

  // Keep onTurn callback fresh without recreating the data-channel handler
  const onTurnRef = useRef(onTurn);
  useEffect(() => { onTurnRef.current = onTurn; }, [onTurn]);

  // Scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  const cleanup = () => {
    try { dcRef.current?.close(); } catch { /* ignore */ }
    try { pcRef.current?.close(); } catch { /* ignore */ }
    streamRef.current?.getTracks().forEach(t => t.stop());
    dcRef.current = null;
    pcRef.current = null;
    streamRef.current = null;
  };

  // ── Send a Realtime API event over the data channel ───────────────────────
  const sendEvent = (event: Record<string, unknown>) => {
    if (dcRef.current?.readyState === 'open') {
      dcRef.current.send(JSON.stringify(event));
    }
  };

  // ── Data-channel message handler ──────────────────────────────────────────
  // Use a ref so the dc.onmessage closure always calls the latest version
  // (avoids stale captures over state/props).
  const msgHandlerRef = useRef<(data: string) => void>(undefined);
  msgHandlerRef.current = (raw: string) => {
    let event: Record<string, unknown>;
    try { event = JSON.parse(raw) as Record<string, unknown>; } catch { return; }
    const type = event.type as string;

    switch (type) {
      // Session ready → start listening
      case 'session.created':
      case 'session.updated':
        setSessionState('listening');
        break;

      // Server VAD: user started speaking — create a streaming placeholder
      case 'input_audio_buffer.speech_started': {
        userTurnTextRef.current = '';
        setSessionState('user_speaking');
        const userId = crypto.randomUUID();
        currentUserIdRef.current = userId;
        setTranscript(prev => [...prev, { id: userId, role: 'user', text: '', streaming: true }]);
        break;
      }

      // Server VAD: user paused
      case 'input_audio_buffer.speech_stopped':
        setSessionState('processing');
        break;

      // Streaming user transcript delta
      case 'conversation.item.input_audio_transcription.delta': {
        const delta = (event.delta as string | undefined) ?? '';
        const uid = currentUserIdRef.current;
        if (uid && delta) {
          setTranscript(prev =>
            prev.map(e => e.id === uid ? { ...e, text: e.text + delta } : e),
          );
        }
        break;
      }

      // User transcript ready
      case 'conversation.item.input_audio_transcription.completed': {
        const text = (event.transcript as string | undefined)?.trim() ?? '';
        if (!text) break;
        userTurnTextRef.current = text;
        const uid = currentUserIdRef.current;
        currentUserIdRef.current = null;
        setTranscript(prev => {
          if (uid) {
            // Finalize the streaming entry we created on speech_started
            return prev.map(e => e.id === uid ? { ...e, text, streaming: false } : e);
          }
          // Fallback: no streaming entry exists, append a new one
          return [...prev, { id: crypto.randomUUID(), role: 'user', text, streaming: false }];
        });
        // Detect farewell or inappropriate requests — Sandra will respond
        // with "Goodbye for now!" and then response.done will close the session.
        const FAREWELL_RE = /\b(bye|goodbye|good\s*bye|see\s+you|au\s*revoir|end\s+(the\s+)?(call|conversation|chat|session)|hang\s+up|i[''']m\s+(done|good|all\s+set)|that[''']?s?\s+all|no\s+more\s+questions|stop\s+(talking|the\s+(call|chat)))\b/i;
        const INAPPROPRIATE_RE = /\b(porn|sex(ual)?|naked|nude|kill\s+(you|someone|people)|murder|make\s+a\s+bomb|how\s+to\s+(hack|make\s+(drugs|weapons?))|racist|slur)\b/i;
        if (FAREWELL_RE.test(text) || INAPPROPRIATE_RE.test(text)) {
          pendingEndRef.current = true;
        }
        break;
      }

      // Sandra starts generating
      case 'response.created': {
        const id = crypto.randomUUID();
        currentAssistantIdRef.current = id;
        setSessionState('assistant_speaking');
        setTranscript(prev => [...prev, { id, role: 'assistant', text: '', streaming: true }]);
        break;
      }

      // Streaming transcript delta
      case 'response.audio_transcript.delta': {
        const delta = (event.delta as string | undefined) ?? '';
        const id = currentAssistantIdRef.current;
        if (id && delta) {
          setTranscript(prev =>
            prev.map(e => e.id === id ? { ...e, text: e.text + delta } : e),
          );
        }
        break;
      }

      // Final transcript for this turn
      case 'response.audio_transcript.done': {
        const finalText = (event.transcript as string | undefined) ?? '';
        const id = currentAssistantIdRef.current;
        if (id) {
          setTranscript(prev =>
            prev.map(e => e.id === id ? { ...e, text: finalText, streaming: false } : e),
          );
          onTurnRef.current?.(userTurnTextRef.current, finalText);
        }
        // If Sandra said the farewell phrase, schedule end after audio finishes
        if (/goodbye for now/i.test(finalText)) {
          pendingEndRef.current = true;
        }
        break;
      }

      // Response fully done → back to listening (or end if farewell was detected)
      case 'response.done':
        currentAssistantIdRef.current = null;
        if (pendingEndRef.current) {
          pendingEndRef.current = false;
          // Give the TTS audio ~1.5 s to finish before closing
          setTimeout(() => { cleanup(); setSessionState('idle'); setTranscript([]); }, 1500);
        } else {
          setSessionState('listening');
        }
        break;

      // API error
      case 'error': {
        const msg = (event.error as { message?: string } | undefined)?.message ?? 'Realtime API error';
        setError(msg);
        setSessionState('error');
        break;
      }
    }
  };

  // ── Start WebRTC session ──────────────────────────────────────────────────
  const startConversation = async () => {
    setError(null);
    setTranscript([]);
    pendingEndRef.current = false;
    setSessionState('connecting');

    try {
      // 1. Get ephemeral key — our server keeps the real API key safe
      const tokenRes = await fetch('/api/voice/realtime-session', { method: 'POST' });
      if (!tokenRes.ok) {
        const body = await tokenRes.json() as { error?: string };
        throw new Error(body.error ?? 'Failed to create realtime session');
      }
      const tokenData = await tokenRes.json() as { client_secret: { value: string } };
      const ephemeralKey = tokenData.client_secret.value;

      // 2. Peer connection — include STUN so NAT traversal works on all networks
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });
      pcRef.current = pc;

      // Surface hard connection failures to the user
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          setError('Connection failed — please check your network and try again');
          setSessionState('error');
          cleanup();
        }
      };

      // 3. Remote audio track → Sandra's voice plays through the hidden element
      // Explicitly call play() in addition to autoPlay to satisfy browser autoplay policies.
      pc.ontrack = (e) => {
        const audioEl = document.getElementById('sandra-realtime-audio') as HTMLAudioElement | null;
        if (audioEl) {
          audioEl.srcObject = e.streams[0] ?? null;
          void audioEl.play().catch(() => {
            // Autoplay blocked — the user will need to interact with the page first.
            // This is rare since we always start from a button click.
          });
        }
      };

      // 4. Microphone input
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = ms;
      ms.getTracks().forEach(t => pc.addTrack(t, ms));

      // 5. Data channel for events
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        const langHint = realtimeLanguageHint(language);
        sendEvent({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: VOICE_INSTRUCTIONS,
            voice: 'alloy',
            input_audio_transcription: {
              model: 'gpt-4o-transcribe',
              // Passing 'fr' for Haitian Creole users anchors the model in the
              // Latin script and avoids CJK hallucinations on ambiguous phonemes.
              ...(langHint ? { language: langHint } : {}),
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 700,
            },
          },
        });
      };

      dc.onmessage = (e) => msgHandlerRef.current?.(e.data as string);

      // 6. SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 7. Exchange SDP with OpenAI (using ephemeral key, not the real API key)
      const sdpRes = await fetch(
        `https://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp,
        },
      );

      if (!sdpRes.ok) {
        throw new Error(`WebRTC handshake failed: ${sdpRes.status} ${await sdpRes.text()}`);
      }

      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      // sessionState → 'listening' when session.created arrives on data channel

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start');
      setSessionState('error');
      cleanup();
    }
  };

  const endConversation = () => { cleanup(); setSessionState('idle'); setTranscript([]); };
  const interrupt = () => { sendEvent({ type: 'response.cancel' }); };

  // ── Real-time audio FFT visualizer ──────────────────────────────────────────
  useEffect(() => {
    if (sessionState !== 'assistant_speaking') {
      cancelAnimationFrame(vizRafRef.current);
      return;
    }
    const audioEl = document.getElementById('sandra-realtime-audio') as HTMLAudioElement | null;
    const canvas = vizCanvasRef.current;
    if (!audioEl || !canvas) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    try {
      if (!_audioCtx) _audioCtx = new AudioContext();
      if (_audioCtx.state === 'suspended') void _audioCtx.resume();
      if (!_analyser) {
        _analyser = _audioCtx.createAnalyser();
        _analyser.fftSize = 256;
        _analyser.smoothingTimeConstant = 0.85;
      }
      if (!_src) {
        _src = _audioCtx.createMediaElementSource(audioEl);
        _src.connect(_analyser);
        _analyser.connect(_audioCtx.destination);
      }
    } catch {
      return; // AudioContext setup failed; degrade gracefully
    }

    const bufLen = _analyser.frequencyBinCount;
    const data = new Uint8Array(bufLen);
    const BARS = 38;

    const render = () => {
      vizRafRef.current = requestAnimationFrame(render);
      _analyser!.getByteFrequencyData(data);
      const w = canvas.width;
      const h = canvas.height;
      ctx2d.clearRect(0, 0, w, h);
      const step = Math.floor(bufLen / BARS);
      const bw = w / BARS;
      for (let i = 0; i < BARS; i++) {
        const val = data[i * step] ?? 0;
        const bh = Math.max((val / 255) * h, 2);
        const x = i * bw + bw * 0.1;
        const bwDraw = bw * 0.8;
        const g = ctx2d.createLinearGradient(0, h, 0, h - bh);
        g.addColorStop(0, 'rgba(26,105,216,0.85)');
        g.addColorStop(1, 'rgba(93,185,250,1)');
        ctx2d.fillStyle = g;
        ctx2d.fillRect(x, h - bh, bwDraw, bh);
      }
    };

    render();
    return () => cancelAnimationFrame(vizRafRef.current);
  }, [sessionState]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => { cleanup(); }, []);

  // ── Derived UI ─────────────────────────────────────────────────────────────
  type StateConfig = {
    label: string;
    orbClass: string;
    showRings: boolean;
    ringColor: string;
  };
  const STATE: Record<SessionState, StateConfig> = {
    idle:               { label: 'Press Start to begin',     orbClass: 'bg-slate-700 border border-white/10',               showRings: false, ringColor: '' },
    connecting:         { label: 'Connecting…',               orbClass: 'bg-amber-500',                                      showRings: false, ringColor: '' },
    listening:          { label: 'Listening — speak freely',  orbClass: 'bg-sandra-600 glow-blue-sm',                        showRings: true,  ringColor: 'border-sandra-400/35' },
    user_speaking:      { label: 'Hearing you…',              orbClass: 'bg-green-500 glow-green',                           showRings: true,  ringColor: 'border-green-400/40' },
    processing:         { label: 'Sandra is thinking…',       orbClass: 'bg-amber-400',                                      showRings: false, ringColor: '' },
    assistant_speaking: { label: 'Sandra is speaking…',       orbClass: 'bg-gradient-to-br from-sandra-400 to-sandra-700 glow-blue', showRings: true, ringColor: 'border-sandra-400/30' },
    error:              { label: 'Error',                      orbClass: 'bg-red-500 glow-red',                              showRings: false, ringColor: '' },
  };

  const { label, orbClass, showRings, ringColor } = STATE[sessionState];
  const isActive = !['idle', 'error'].includes(sessionState);

  return (
    <>
      {/* Hidden audio — Sandra's realtime voice output */}
      <audio id="sandra-realtime-audio" autoPlay className="hidden" />

      {/* ── Compact idle trigger ──────────────────────────────────────────── */}
      {!isActive && (
        <div className="mb-2">
          <button
            onClick={() => void startConversation()}
            disabled={sessionState === 'connecting'}
            className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left transition-all hover:border-white/[0.12] hover:bg-white/[0.04] active:scale-[0.99] disabled:opacity-50"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sandra-500 to-sandra-700">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium text-slate-200">Talk to Sandra</span>
              <span className="ml-2 text-xs text-slate-600">Live voice</span>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold tracking-wider text-sandra-500">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sandra-500" />
              LIVE
            </span>
          </button>
          {error && <p className="mt-1.5 text-center text-xs text-red-400">{error}</p>}
        </div>
      )}

      {/* ── Active voice panel ──────────────────────────────────────────────── */}
      {isActive && (
        <div className="relative mb-2 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#1a1a1a]">
          {/* Particle cloud behind orb */}
          <ParticleCanvas
            active={sessionState === 'assistant_speaking' || sessionState === 'user_speaking'}
            className="pointer-events-none absolute inset-0 opacity-60"
          />
          <div className="relative z-10 flex flex-col items-center px-4 pb-5 pt-6">
            {/* Status label */}
            <p className="mb-4 text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-500">
              {label}
            </p>

            {/* Orb + rings */}
            <div className="relative flex h-24 w-24 items-center justify-center">
              {showRings && (
                <>
                  <div className={`absolute h-20 w-20 rounded-full border ${ringColor} animate-ring-out`} />
                  <div className={`absolute h-20 w-20 rounded-full border ${ringColor} animate-ring-out-delayed`} />
                </>
              )}
              <div
                className={`relative z-10 flex h-16 w-16 items-center justify-center shadow-xl transition-[box-shadow,filter,border-radius] duration-500 ${orbClass} ${
                  sessionState === 'assistant_speaking' ? 'animate-morph' : 'rounded-full'
                } ${showRings ? 'animate-glow-pulse' : ''}`}
              >
                {['listening', 'user_speaking'].includes(sessionState) && (
                  <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                  </svg>
                )}
                {['connecting', 'processing'].includes(sessionState) && (
                  <svg className="h-7 w-7 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {sessionState === 'assistant_speaking' && (
                  <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                  </svg>
                )}
                {sessionState === 'error' && (
                  <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.948 3.374H4.645c-1.73 0-2.813-1.874-1.948-3.374l7.698-13.314c.866-1.5 3.032-1.5 3.898 0l7.698 13.314ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                )}
              </div>
            </div>

            {/* Real-time audio FFT canvas */}
            {sessionState === 'assistant_speaking' && (
              <canvas ref={vizCanvasRef} width={200} height={40} className="mt-3 rounded opacity-80" />
            )}

            {/* Controls */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={endConversation}
                className="rounded-full border border-red-500/30 bg-red-500/10 px-5 py-2 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/20 active:scale-95"
              >
                End
              </button>
              {sessionState === 'assistant_speaking' && (
                <button
                  onClick={interrupt}
                  className="rounded-full border border-white/[0.08] px-4 py-2 text-xs text-slate-500 transition-all hover:bg-white/[0.04] hover:text-slate-300 active:scale-95"
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
