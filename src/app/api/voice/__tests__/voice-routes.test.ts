import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    OPENAI_API_KEY: 'sk-test-key' as string | undefined,
    OPENAI_TTS_VOICE: 'alloy' as string | undefined,
  },
}));

vi.mock('@/lib/config', () => ({ env: mockEnv }));

vi.mock('@/lib/channels/voice', () => ({
  transcribeAudio: vi.fn(),
  synthesizeSpeech: vi.fn(),
  getVoiceAdapter: vi.fn(),
}));

vi.mock('@/lib/channels/voice-formatter', () => ({
  formatForVoice: (t: string) => t,
  estimateSpeakDuration: () => 5,
}));

vi.mock('@/lib/channels/channel-identity', () => ({
  resolveChannelIdentity: vi.fn().mockResolvedValue({ userId: 'user-voice-1' }),
}));

vi.mock('@/lib/memory/session-continuity', () => ({
  getOrCreateSessionForChannel: vi.fn().mockResolvedValue({
    sessionId: 'voice-session-abc',
    language: 'en',
  }),
  ensureSessionContinuity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/agents', () => ({
  runSandraAgent: vi.fn().mockResolvedValue({
    response: 'Hello from Sandra!',
    language: 'en',
    toolsUsed: [],
  }),
}));

vi.mock('@/lib/i18n', () => ({
  resolveLanguage: vi.fn().mockReturnValue('en'),
}));

vi.mock('@/lib/auth', () => ({
  getScopesForRole: vi.fn().mockReturnValue([]),
}));

vi.mock('@/lib/tools/resilience', () => ({
  setCorrelationId: vi.fn(),
  clearCorrelationId: vi.fn(),
}));

vi.mock('@/lib/utils', () => ({
  generateRequestId: vi.fn().mockReturnValue('req-voice-test'),
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

function makeAudioFile(filename = 'audio.mp3', type = 'audio/mpeg'): File {
  return new File([new Blob(['fake-audio'], { type })], filename, { type });
}

function makeAudioFormData(filename = 'audio.mp3', type = 'audio/mpeg'): FormData {
  const fd = new FormData();
  fd.append('audio', makeAudioFile(filename, type));
  return fd;
}

function makeTranscribeRequest(formData: FormData): Request {
  return new Request('http://localhost/api/voice/transcribe', {
    method: 'POST',
    body: formData,
  });
}

describe('POST /api/voice/transcribe', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns transcription for a valid audio file', async () => {
    const { transcribeAudio } = await import('@/lib/channels/voice');
    vi.mocked(transcribeAudio).mockResolvedValue({ text: 'Hello Sandra', language: 'en' });

    const { POST } = await import('../transcribe/route');
    const res = await POST(makeTranscribeRequest(makeAudioFormData()));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.transcription).toBe('Hello Sandra');
    expect(body.language).toBe('en');
    expect(typeof body.estimatedWords).toBe('number');
  });

  it('returns 400 when audio field is missing', async () => {
    const { POST } = await import('../transcribe/route');
    const res = await POST(makeTranscribeRequest(new FormData()));
    expect(res.status).toBe(400);
  });

  it('returns 400 for unsupported MIME type', async () => {
    const { POST } = await import('../transcribe/route');
    const fd = new FormData();
    fd.append('audio', new File(['data'], 'note.txt', { type: 'text/plain' }));
    const res = await POST(makeTranscribeRequest(fd));
    expect(res.status).toBe(400);
  });

  it('returns 500 when Whisper API fails', async () => {
    const { transcribeAudio } = await import('@/lib/channels/voice');
    vi.mocked(transcribeAudio).mockRejectedValue(new Error('Whisper API error: HTTP 500'));
    const { POST } = await import('../transcribe/route');
    const res = await POST(makeTranscribeRequest(makeAudioFormData()));
    expect(res.status).toBe(500);
  });
});

describe('POST /api/voice/speak', () => {
  beforeEach(() => vi.clearAllMocks());

  function makeSpeakRequest(body: object): Request {
    return new Request('http://localhost/api/voice/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('returns audio binary for valid text', async () => {
    const { synthesizeSpeech } = await import('@/lib/channels/voice');
    vi.mocked(synthesizeSpeech).mockResolvedValue(Buffer.from('fake-mp3'));
    const { POST } = await import('../speak/route');
    const res = await POST(makeSpeakRequest({ text: 'Hello Sandra' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('audio');
  });

  it('returns 400 for missing text', async () => {
    const { POST } = await import('../speak/route');
    const res = await POST(makeSpeakRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 for text exceeding 4096 chars', async () => {
    const { POST } = await import('../speak/route');
    const res = await POST(makeSpeakRequest({ text: 'a'.repeat(4097) }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid voice', async () => {
    const { POST } = await import('../speak/route');
    const res = await POST(makeSpeakRequest({ text: 'Hello', voice: 'bad-voice' }));
    expect(res.status).toBe(400);
  });

  it('returns 500 when TTS API fails', async () => {
    const { synthesizeSpeech } = await import('@/lib/channels/voice');
    vi.mocked(synthesizeSpeech).mockRejectedValue(new Error('TTS API error: HTTP 429'));
    const { POST } = await import('../speak/route');
    const res = await POST(makeSpeakRequest({ text: 'Hello' }));
    expect(res.status).toBe(500);
  });
});

describe('POST /api/voice/realtime-session', () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function makeRequest(): Request {
    return new Request('http://localhost/api/voice/realtime-session', { method: 'POST' });
  }

  it('returns the OpenAI session payload including client_secret', async () => {
    const sessionPayload = {
      id: 'sess_abc123',
      object: 'realtime.session',
      model: 'gpt-4o-realtime-preview',
      voice: 'alloy',
      client_secret: { value: 'ek_ephemeral_xyz', expires_at: 9999999999 },
    };
    mockFetch.mockResolvedValue(new Response(JSON.stringify(sessionPayload), { status: 200 }));

    const { POST } = await import('../realtime-session/route');
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.client_secret.value).toBe('ek_ephemeral_xyz');
    expect(body.model).toBe('gpt-4o-realtime-preview');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/realtime/sessions',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns 502 when OpenAI rejects the request', async () => {
    mockFetch.mockResolvedValue(new Response('Unauthorized', { status: 401 }));

    const { POST } = await import('../realtime-session/route');
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toContain('401');
  });

  it('returns 500 when fetch throws a network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network unreachable'));

    const { POST } = await import('../realtime-session/route');
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Network unreachable');
  });
});

describe('POST /api/voice/chat', () => {
  beforeEach(() => vi.clearAllMocks());

  function makeChatRequest(formData: FormData): Request {
    return new Request('http://localhost/api/voice/chat', {
      method: 'POST',
      body: formData,
    });
  }

  it('returns full round-trip response', async () => {
    const { transcribeAudio, synthesizeSpeech } = await import('@/lib/channels/voice');
    vi.mocked(transcribeAudio).mockResolvedValue({ text: 'What is EdLight?', language: 'en' });
    vi.mocked(synthesizeSpeech).mockResolvedValue(Buffer.from('fake-mp3'));

    const { POST } = await import('../chat/route');
    const res = await POST(makeChatRequest(makeAudioFormData()));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.transcription).toBe('What is EdLight?');
    expect(body.response).toBe('Hello from Sandra!');
    expect(typeof body.audio).toBe('string');
    expect(body.sessionId).toBe('voice-session-abc');
    expect(typeof body.estimatedSpeakSeconds).toBe('number');
  });

  it('returns 400 when audio is missing', async () => {
    const { POST } = await import('../chat/route');
    const res = await POST(makeChatRequest(new FormData()));
    expect(res.status).toBe(400);
  });

  it('returns 422 when transcription is empty', async () => {
    const { transcribeAudio } = await import('@/lib/channels/voice');
    vi.mocked(transcribeAudio).mockResolvedValue({ text: '', language: 'en' });
    const { POST } = await import('../chat/route');
    const res = await POST(makeChatRequest(makeAudioFormData()));
    expect(res.status).toBe(422);
  });
});
