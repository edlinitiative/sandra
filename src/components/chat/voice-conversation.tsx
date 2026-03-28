'use client';

/**
 * VoiceConversation — live, continuous voice chat with Sandra.
 *
 * Flow per turn:
 *   1. Record audio using MediaRecorder + Web Audio API
 *   2. Silence detection (1.5 s below threshold) auto-stops the recording
 *   3. POST audio to /api/voice/chat → transcription + TTS audio
 *   4. Play TTS response; when it ends, restart listening automatically
 *   5. Loop until the user presses "End"
 */

import { useState, useRef, useEffect } from 'react';

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

interface VoiceTurn {
  id: string;
  userText: string;
  assistantText: string;
}

interface VoiceConversationProps {
  /** Session ID to maintain context across turns (uses voice-session internally if not provided). */
  sessionId?: string;
  /** Language hint forwarded to the API. */
  language?: string;
  /** Called after each completed turn so the parent can mirror messages into the text chat. */
  onTurn?: (userText: string, assistantText: string) => void;
  /** Called when a new sessionId is minted by the API. */
  onSessionId?: (id: string) => void;
}

// ── Silence detection constants ────────────────────────────────────────────────
/** Average frequency amplitude (0-255) below which we count as "silence". */
const SILENCE_THRESHOLD = 14;
/** How long silence must last before we auto-stop recording (ms). */
const SILENCE_DURATION_MS = 1500;
/** Minimum recording time before silence detection kicks in (ms). */
const MIN_RECORDING_MS = 600;

export function VoiceConversation({
  sessionId: externalSessionId,
  language,
  onTurn,
  onSessionId,
}: VoiceConversationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  // ── Stable refs (no re-render on change) ──────────────────────────────────
  const isActiveRef = useRef(false);
  const sessionIdRef = useRef(externalSessionId ?? '');
  const languageRef = useRef(language ?? 'en');
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const rafRef = useRef<number>(0);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const turnsEndRef = useRef<HTMLDivElement>(null);

  // Keep refs synced with prop changes
  useEffect(() => { languageRef.current = language ?? 'en'; }, [language]);
  useEffect(() => {
    if (externalSessionId) sessionIdRef.current = externalSessionId;
  }, [externalSessionId]);

  // Scroll transcript on new turns
  useEffect(() => {
    turnsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  const cleanup = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current?.state !== 'closed') {
      void audioCtxRef.current?.close();
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    if (recorderRef.current?.state !== 'inactive') {
      try { recorderRef.current?.stop(); } catch { /* ignore */ }
    }
    recorderRef.current = null;
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.onended = null;
      currentAudioRef.current = null;
    }
    setAudioLevel(0);
  };

  // ── Conversation loop ──────────────────────────────────────────────────────
  // Stored in a ref so each step can call "next turn" without circular deps
  const loopRef = useRef<(() => Promise<void>) | undefined>(undefined);

  loopRef.current = async () => {
    if (!isActiveRef.current) return;

    setError(null);
    setVoiceState('listening');
    setAudioLevel(0);

    // ── 1. Acquire microphone ──────────────────────────────────────────────
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      isActiveRef.current = false;
      setError(err instanceof Error ? err.message : 'Microphone access denied');
      setVoiceState('idle');
      return;
    }
    if (!isActiveRef.current) { stream.getTracks().forEach(t => t.stop()); return; }

    streamRef.current = stream;

    // ── 2. Web Audio — level monitoring ───────────────────────────────────
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;
    const dataArr = new Uint8Array(analyser.frequencyBinCount);

    // ── 3. MediaRecorder ──────────────────────────────────────────────────
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    const recordingStart = Date.now();
    recorder.start(100);

    // ── 4. Silence detection ──────────────────────────────────────────────
    let silenceStart = 0;
    const checkSilence = () => {
      if (!isActiveRef.current || recorder.state !== 'recording') return;
      analyser.getByteFrequencyData(dataArr);
      const avg = dataArr.reduce((s, v) => s + v, 0) / dataArr.length;
      setAudioLevel(avg);

      if (Date.now() - recordingStart > MIN_RECORDING_MS) {
        if (avg < SILENCE_THRESHOLD) {
          if (!silenceStart) silenceStart = Date.now();
          else if (Date.now() - silenceStart >= SILENCE_DURATION_MS) {
            recorder.stop(); // triggers onstop
            return;
          }
        } else {
          silenceStart = 0;
        }
      }
      rafRef.current = requestAnimationFrame(checkSilence);
    };
    rafRef.current = requestAnimationFrame(checkSilence);

    // ── 5. Wait for recording to stop ────────────────────────────────────
    await new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        cancelAnimationFrame(rafRef.current);
        stream.getTracks().forEach(t => t.stop());
        await audioCtx.close();
        streamRef.current = null;
        audioCtxRef.current = null;
        analyserRef.current = null;
        setAudioLevel(0);

        if (!isActiveRef.current) { resolve(); return; }

        const blob = new Blob(chunks, { type: mimeType });
        const duration = Date.now() - recordingStart;

        // Too short or empty → restart without hitting the API
        if (blob.size < 500 || duration < MIN_RECORDING_MS + 200) {
          resolve();
          void loopRef.current?.();
          return;
        }

        setVoiceState('processing');

        // ── 6. Send to API ───────────────────────────────────────────────
        try {
          const fd = new FormData();
          fd.append('audio', blob, 'recording.webm');
          if (sessionIdRef.current) fd.append('sessionId', sessionIdRef.current);
          fd.append('language', languageRef.current);

          const res = await fetch('/api/voice/chat', { method: 'POST', body: fd });
          const data = await res.json() as {
            transcription?: string;
            response?: string;
            audio?: string;
            sessionId?: string;
            error?: string;
          };

          if (!isActiveRef.current) { resolve(); return; }

          // API returned an error or nothing was transcribed → try again
          if (!res.ok || !data.transcription?.trim()) {
            resolve();
            void loopRef.current?.();
            return;
          }

          // Persist new session ID
          if (data.sessionId && data.sessionId !== sessionIdRef.current) {
            sessionIdRef.current = data.sessionId;
            onSessionId?.(data.sessionId);
          }

          // Update transcript
          const turn: VoiceTurn = {
            id: crypto.randomUUID(),
            userText: data.transcription,
            assistantText: data.response ?? '',
          };
          setTurns(prev => [...prev, turn]);
          onTurn?.(data.transcription, data.response ?? '');

          // ── 7. Play TTS response ─────────────────────────────────────
          if (data.audio && isActiveRef.current) {
            setVoiceState('speaking');
            const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
            currentAudioRef.current = audio;

            await new Promise<void>((r) => {
              audio.onended = () => r();
              audio.onerror = () => r();
              audio.play().catch(() => r()); // autoplay may be blocked
            });

            currentAudioRef.current = null;
          }
        } catch {
          // Network / JSON error — silently retry
        }

        // ── 8. Loop back to listening ────────────────────────────────────
        resolve();
        if (isActiveRef.current) void loopRef.current?.();
      };
    });
  };

  // ── Public controls ────────────────────────────────────────────────────────
  const startConversation = async () => {
    isActiveRef.current = true;
    setTurns([]);
    setError(null);
    void loopRef.current?.();
  };

  const endConversation = () => {
    isActiveRef.current = false;
    cleanup();
    setVoiceState('idle');
  };

  const closeModal = () => {
    endConversation();
    setIsOpen(false);
    setTurns([]);
  };

  // Cleanup on unmount
  useEffect(() => () => { isActiveRef.current = false; cleanup(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Normalize audio level to 0–1 for visual scale
  const levelNorm = Math.min(audioLevel / 55, 1);

  const stateLabel = {
    idle: 'Press Start to begin',
    listening: 'Listening — pause to send',
    processing: 'Sandra is thinking…',
    speaking: 'Sandra is speaking…',
  }[voiceState];

  return (
    <>
      {/* ── Trigger button (rendered inside chat header) ── */}
      <button
        onClick={() => setIsOpen(true)}
        title="Start live voice conversation"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200"
      >
        {/* Chat-bubble-with-waves icon */}
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
        </svg>
      </button>

      {/* ── Modal overlay ── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="relative flex w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="font-semibold text-gray-900">Live Voice Conversation</h2>
                <p className="text-xs text-gray-400">{stateLabel}</p>
              </div>
              <button
                onClick={closeModal}
                className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Visual indicator */}
            <div className="flex flex-col items-center py-10">
              <div className="relative flex items-center justify-center">

                {/* Listening — rings that grow with voice level */}
                {voiceState === 'listening' && (
                  <>
                    <div
                      className="absolute rounded-full bg-sandra-400/25 transition-all duration-75"
                      style={{
                        width: `${80 + levelNorm * 64}px`,
                        height: `${80 + levelNorm * 64}px`,
                      }}
                    />
                    <div
                      className="absolute rounded-full bg-sandra-400/12 transition-all duration-75"
                      style={{
                        width: `${108 + levelNorm * 80}px`,
                        height: `${108 + levelNorm * 80}px`,
                      }}
                    />
                  </>
                )}

                {/* Speaking — animated ping rings */}
                {voiceState === 'speaking' && (
                  <>
                    <div className="absolute h-24 w-24 animate-ping rounded-full bg-indigo-400/20" />
                    <div className="absolute h-20 w-20 animate-ping rounded-full bg-indigo-400/25 [animation-delay:350ms]" />
                  </>
                )}

                {/* Center circle */}
                <div
                  className={`relative z-10 flex h-16 w-16 items-center justify-center rounded-full transition-colors duration-300 ${
                    voiceState === 'idle'       ? 'bg-gray-100' :
                    voiceState === 'listening'  ? 'bg-sandra-600' :
                    voiceState === 'processing' ? 'bg-amber-400' :
                                                  'bg-indigo-500'
                  }`}
                >
                  {/* Microphone */}
                  {(voiceState === 'idle' || voiceState === 'listening') && (
                    <svg
                      className={`h-7 w-7 ${voiceState === 'idle' ? 'text-gray-500' : 'text-white'}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                    </svg>
                  )}
                  {/* Spinner */}
                  {voiceState === 'processing' && (
                    <svg className="h-7 w-7 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {/* Speaker */}
                  {voiceState === 'speaking' && (
                    <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Error */}
              {error && (
                <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-xs text-red-600">{error}</p>
              )}
            </div>

            {/* Conversation transcript */}
            {turns.length > 0 && (
              <div className="max-h-56 overflow-y-auto border-t border-gray-100 px-5 py-3">
                <div className="space-y-4">
                  {turns.map((turn) => (
                    <div key={turn.id} className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                        <span className="text-xs font-medium text-gray-400">You</span>
                      </div>
                      <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">{turn.userText}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-sandra-400" />
                        <span className="text-xs font-medium text-sandra-600">Sandra</span>
                      </div>
                      <p className="rounded-lg bg-sandra-50 px-3 py-2 text-sm text-gray-800">{turn.assistantText}</p>
                    </div>
                  ))}
                  <div ref={turnsEndRef} />
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-3 border-t border-gray-100 px-5 py-4">
              {voiceState === 'idle' ? (
                <button
                  onClick={() => void startConversation()}
                  className="flex-1 rounded-xl bg-sandra-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-sandra-700"
                >
                  🎤 Start Conversation
                </button>
              ) : (
                <>
                  <button
                    onClick={endConversation}
                    className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-600"
                  >
                    ■ End Conversation
                  </button>
                  {voiceState === 'listening' && (
                    <button
                      onClick={() => {
                        if (recorderRef.current?.state === 'recording') {
                          recorderRef.current.stop();
                        }
                      }}
                      className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                    >
                      Send now
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
