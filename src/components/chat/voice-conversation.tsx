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

This is a voice conversation. Be warm and conversational. Keep answers to 1-3 sentences unless the user asks for more detail. Never read bullet lists aloud — summarize naturally instead.`;

// ── Component ─────────────────────────────────────────────────────────────────
export function VoiceConversation({ onTurn }: VoiceConversationProps) {
  const [isOpen, setIsOpen] = useState(false);
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
        break;
      }

      // Response fully done → back to listening
      case 'response.done':
        currentAssistantIdRef.current = null;
        setSessionState('listening');
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

      // 2. Peer connection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // 3. Remote audio track → Sandra's voice plays through the hidden element
      pc.ontrack = (e) => {
        const audioEl = document.getElementById('sandra-realtime-audio') as HTMLAudioElement | null;
        if (audioEl) audioEl.srcObject = e.streams[0] ?? null;
      };

      // 4. Microphone input
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = ms;
      ms.getTracks().forEach(t => pc.addTrack(t, ms));

      // 5. Data channel for events
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        sendEvent({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: VOICE_INSTRUCTIONS,
            voice: 'alloy',
            input_audio_transcription: { model: 'gpt-4o-transcribe' },
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

  const endConversation = () => { cleanup(); setSessionState('idle'); };
  const interrupt = () => { sendEvent({ type: 'response.cancel' }); };
  const closeModal = () => { endConversation(); setIsOpen(false); setTranscript([]); };

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

  // Waveform bar heights for assistant_speaking (relative proportions)
  const WAVE_SCALES = [0.4, 0.7, 0.9, 0.6, 1, 0.7, 1, 0.6, 0.9, 0.7, 0.4];

  return (
    <>
      {/* Hidden audio — Sandra's realtime voice output */}
      <audio id="sandra-realtime-audio" autoPlay className="hidden" />

      {/* Trigger button in chat header */}
      <button
        onClick={() => setIsOpen(true)}
        title="Live voice conversation (Realtime API)"
        className="flex h-8 w-8 items-center justify-center rounded-full glass border border-sandra-500/30 text-sandra-400 transition-all hover:border-sandra-500/60 hover:text-sandra-300 hover:glow-blue-sm"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#030b14] cyber-grid">
          {/* Ambient glow */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_30%,rgba(56,157,246,0.1),transparent)]" />

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/[0.06] glass px-5 py-4">
            <div>
              <h2 className="font-semibold text-white">Live Voice</h2>
              <p className="mt-0.5 text-xs text-slate-500">{label}</p>
            </div>
            <button
              onClick={closeModal}
              className="rounded-full p-1.5 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* ── Central visual indicator ─────────────────────────────── */}
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center py-8">

            {/* Orb + rings */}
            <div className="relative flex h-40 w-40 items-center justify-center">
              {showRings && (
                <>
                  <div className={`absolute h-36 w-36 rounded-full border ${ringColor} animate-ring-out`} />
                  <div className={`absolute h-36 w-36 rounded-full border ${ringColor} animate-ring-out-delayed`} />
                  {/* Static ambient halo */}
                  <div className="absolute h-24 w-24 rounded-full bg-sandra-500/8 blur-xl" />
                </>
              )}

              {/* The orb */}
              <div className={`relative z-10 flex h-24 w-24 items-center justify-center rounded-full shadow-2xl transition-all duration-500 ${orbClass} ${showRings ? 'animate-glow-pulse' : ''}`}>
                {['idle', 'listening', 'user_speaking'].includes(sessionState) && (
                  <svg
                    className={`h-10 w-10 ${sessionState === 'idle' ? 'text-slate-500' : 'text-white'}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                  </svg>
                )}
                {['connecting', 'processing'].includes(sessionState) && (
                  <svg className="h-10 w-10 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {sessionState === 'assistant_speaking' && (
                  <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                  </svg>
                )}
                {sessionState === 'error' && (
                  <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.948 3.374H4.645c-1.73 0-2.813-1.874-1.948-3.374l7.698-13.314c.866-1.5 3.032-1.5 3.898 0l7.698 13.314ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                )}
              </div>
            </div>

            {/* Waveform spectrum — only when Sandra is speaking */}
            {sessionState === 'assistant_speaking' && (
              <div className="mt-6 flex h-12 items-center justify-center gap-[4px]">
                {WAVE_SCALES.map((scale, i) => (
                  <div
                    key={i}
                    className="w-[4px] rounded-full bg-sandra-400 soundwave-bar"
                    style={{
                      height: `${scale * 100}%`,
                      animationDelay: `${i * 75}ms`,
                    }}
                  />
                ))}
              </div>
            )}

            {error && (
              <p className="mt-6 max-w-xs rounded-xl border border-red-500/20 bg-red-900/20 px-4 py-2 text-center text-xs text-red-400">
                {error}
              </p>
            )}
          </div>

          {/* ── Transcript ───────────────────────────────────────────── */}
          {transcript.length > 0 && (
            <div className="relative z-10 max-h-[32vh] overflow-y-auto border-t border-white/[0.06] px-5 py-4">
              <div className="space-y-3">
                {transcript.map((entry) => (
                  <div key={entry.id} className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${entry.role === 'user' ? 'bg-slate-500' : 'bg-sandra-400'}`} />
                      <span className={`text-xs font-medium ${entry.role === 'user' ? 'text-slate-500' : 'text-sandra-400'}`}>
                        {entry.role === 'user' ? 'You' : 'Sandra'}
                      </span>
                      {entry.streaming && (
                        <span className="ml-1 flex h-3 items-center gap-[2px]">
                          {[0, 120, 240].map((d, i) => (
                            <span key={i} className="block w-[2px] h-full rounded-full bg-slate-500 soundwave-bar" style={{ animationDelay: `${d}ms` }} />
                          ))}
                        </span>
                      )}
                    </div>
                    <p
                      className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${
                        entry.role === 'user'
                          ? 'bg-white/[0.04] border border-white/[0.07] text-slate-300'
                          : 'bg-sandra-500/10 border border-sandra-500/20 text-slate-200'
                      }`}
                    >
                      {entry.text || <span className="animate-pulse text-slate-600">…</span>}
                    </p>
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            </div>
          )}

          {/* ── Controls ─────────────────────────────────────────────── */}
          <div className="relative z-10 flex shrink-0 gap-3 border-t border-white/[0.06] glass px-5 py-4">
            {!isActive ? (
              <button
                onClick={() => void startConversation()}
                className="flex-1 rounded-xl bg-gradient-to-r from-sandra-600 to-sandra-500 py-3.5 text-sm font-semibold text-white transition-all glow-blue-sm hover:glow-blue active:scale-[0.98]"
              >
                🎤 Start Conversation
              </button>
            ) : (
              <>
                <button
                  onClick={endConversation}
                  className="flex-1 rounded-xl border border-red-500/30 bg-red-600/70 py-3.5 text-sm font-semibold text-white transition-all hover:bg-red-600/90 active:scale-[0.98]"
                >
                  ■ End
                </button>
                {sessionState === 'assistant_speaking' && (
                  <button
                    onClick={interrupt}
                    className="rounded-xl border border-white/10 px-5 py-3.5 text-sm font-medium text-slate-400 transition-all hover:bg-white/5 hover:text-slate-200 active:scale-[0.98]"
                  >
                    Interrupt
                  </button>
                )}
              </>
            )}
          </div>

        </div>
      )}
    </>
  );
}
