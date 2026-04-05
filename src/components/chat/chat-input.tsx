'use client';

import { useState, useRef, type FormEvent, type KeyboardEvent } from 'react';

export interface VoiceResult {
  transcription: string;
  response: string;
  audio: string; // base64 mp3
  sessionId: string;
  language: string;
  estimatedSpeakSeconds: number;
}

interface ChatInputProps {
  onSend: (message: string) => void;
  onVoiceResult?: (result: VoiceResult) => void;
  voiceSessionId?: string;
  language?: string;
  isLoading?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  onVoiceResult,
  voiceSessionId,
  language,
  isLoading = false,
  placeholder,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const sendVoiceBlob = async (blob: Blob, mimeType: string) => {
    try {
      const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
      const formData = new FormData();
      formData.append('audio', blob, `recording.${ext}`);
      if (voiceSessionId) formData.append('sessionId', voiceSessionId);
      if (language) formData.append('language', language);

      const res = await fetch('/api/voice/chat', { method: 'POST', body: formData });
      const data = await res.json() as VoiceResult & { error?: string };

      if (!res.ok) {
        setVoiceError(data.error ?? 'Voice request failed');
        return;
      }

      onVoiceResult?.(data);
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : 'Voice request failed');
    } finally {
      setIsVoiceLoading(false);
    }
  };

  const startRecording = async () => {
    setVoiceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        await sendVoiceBlob(blob, mimeType);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : 'Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsVoiceLoading(true);
    }
  };

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      void startRecording();
    }
  };

  return (
    <div className="p-2.5">
      {voiceError && (
        <div className="mb-2 flex items-center justify-between rounded-lg border border-red-500/20 bg-red-950/30 px-3 py-1.5 text-xs text-red-400">
          <span>{voiceError}</span>
          <button type="button" onClick={() => setVoiceError(null)} className="ml-2 text-red-500 hover:text-red-300">✕</button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-end gap-1.5">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? '🔴 Recording…' : (placeholder ?? 'Message Sandra…')}
          rows={1}
          disabled={isLoading || isRecording || isVoiceLoading}
          className="flex-1 resize-none bg-transparent px-2 py-2 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:opacity-40"
          style={{ maxHeight: '120px' }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = Math.min(target.scrollHeight, 120) + 'px';
          }}
        />

        {/* Voice record button */}
        {onVoiceResult && (
          <button
            type="button"
            onClick={handleMicClick}
            disabled={isLoading || isVoiceLoading}
            title={isRecording ? 'Stop recording' : 'Record voice message'}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all ${
              isRecording
                ? 'animate-pulse bg-red-500 text-white'
                : isVoiceLoading
                  ? 'cursor-wait text-slate-600'
                  : 'text-slate-500 hover:text-slate-200'
            }`}
          >
            {isVoiceLoading ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : isRecording ? (
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
              </svg>
            )}
          </button>
        )}

        {/* Send button — white circle with up-arrow (ChatGPT-style) */}
        <button
          type="submit"
          disabled={!input.trim() || isLoading || isRecording || isVoiceLoading}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-black transition-all hover:bg-slate-200 disabled:bg-slate-700 disabled:text-slate-500"
        >
          {isLoading ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
