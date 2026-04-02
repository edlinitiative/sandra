import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VoiceChannelAdapter, transcribeAudio, synthesizeSpeech } from '../voice';

// ─── Mock env ─────────────────────────────────────────────────────────────────

vi.mock('@/lib/config', () => ({
  env: {
    OPENAI_API_KEY: 'test-openai-key',
    OPENAI_WHISPER_MODEL: 'whisper-1',
    OPENAI_TTS_MODEL: 'tts-1',
    OPENAI_TTS_VOICE: 'alloy',
  },
}));

// ─── VoiceChannelAdapter ──────────────────────────────────────────────────────

describe('VoiceChannelAdapter', () => {
  const adapter = new VoiceChannelAdapter();

  it('has channelType voice', () => {
    expect(adapter.channelType).toBe('voice');
  });

  it('isConfigured returns true when OPENAI_API_KEY is set', () => {
    expect(adapter.isConfigured()).toBe(true);
  });

  describe('parseInbound', () => {
    it('parses a valid voice payload', async () => {
      const msg = await adapter.parseInbound({
        transcription: 'Hello Sandra',
        channelUserId: 'voice-session-123',
        language: 'en',
      });
      expect(msg.channelType).toBe('voice');
      expect(msg.content).toBe('Hello Sandra');
      expect(msg.channelUserId).toBe('voice-session-123');
      expect(msg.language).toBe('en');
    });

    it('trims whitespace from transcription', async () => {
      const msg = await adapter.parseInbound({
        transcription: '  Hello  ',
        channelUserId: 'voice-user-1',
      });
      expect(msg.content).toBe('Hello');
    });

    it('throws if transcription is missing', async () => {
      await expect(
        adapter.parseInbound({ channelUserId: 'x' }),
      ).rejects.toThrow('missing transcription');
    });

    it('throws if channelUserId is missing', async () => {
      await expect(
        adapter.parseInbound({ transcription: 'hello' }),
      ).rejects.toThrow('missing channelUserId');
    });
  });

  describe('formatOutbound', () => {
    it('returns formatted voice text', async () => {
      const result = await adapter.formatOutbound({
        channelType: 'voice',
        recipientId: 'voice-user-1',
        content: '**Hello** from Sandra!',
      });
      expect(result.text).toBe('Hello from Sandra!');
    });

    it('strips markdown from outbound content', async () => {
      const result = await adapter.formatOutbound({
        channelType: 'voice',
        recipientId: 'voice-user-1',
        content: '## Heading\n- item one\n- item two',
      });
      expect(result.text).not.toContain('##');
      expect(result.text).toContain('Heading');
    });
  });

  describe('send', () => {
    it('is a no-op (voice is synchronous)', async () => {
      await expect(
        adapter.send({ channelType: 'voice', recipientId: 'x', content: 'test' }),
      ).resolves.toBeUndefined();
    });
  });
});

// ─── transcribeAudio ─────────────────────────────────────────────────────────

describe('transcribeAudio', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls Whisper API and returns transcription', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Hello Sandra', language: 'en' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await transcribeAudio(
      Buffer.from('audio-data'),
      'audio/mpeg',
      'audio.mp3',
    );

    expect(result.text).toBe('Hello Sandra');
    expect(result.language).toBe('en');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/audio/transcriptions',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws on Whisper API error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'bad request',
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      transcribeAudio(Buffer.from('x'), 'audio/mpeg', 'audio.mp3'),
    ).rejects.toThrow('Whisper API error: HTTP 400');
  });

  it('passes language hint when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Bonjou', language: 'ht' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await transcribeAudio(Buffer.from('x'), 'audio/mpeg', 'audio.mp3', 'ht');
    expect(result.language).toBe('ht');
  });
});

// ─── synthesizeSpeech ────────────────────────────────────────────────────────

describe('synthesizeSpeech', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls TTS API and returns audio buffer', async () => {
    const fakeAudio = Buffer.from('fake-mp3-data');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => fakeAudio.buffer,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await synthesizeSpeech('Hello Sandra');

    expect(result).toBeInstanceOf(Buffer);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/audio/speech',
      expect.objectContaining({ method: 'POST' }),
    );

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(callBody.input).toBe('Hello Sandra');
    expect(callBody.voice).toBe('alloy');
    expect(callBody.response_format).toBe('mp3');
  });

  it('passes custom voice and format', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    });
    vi.stubGlobal('fetch', mockFetch);

    await synthesizeSpeech('test', 'nova', 'opus');
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(callBody.voice).toBe('nova');
    expect(callBody.response_format).toBe('opus');
  });

  it('throws on TTS API error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(synthesizeSpeech('hello')).rejects.toThrow('TTS API error: HTTP 429');
  });
});
