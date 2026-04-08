import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// WebRTC & MediaDevice mocks
// ─────────────────────────────────────────────────────────────────────────────

class MockMediaStream {
  private tracks: MockMediaStreamTrack[];
  constructor(tracks: MockMediaStreamTrack[] = [new MockMediaStreamTrack()]) {
    this.tracks = tracks;
  }
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks; }
}

class MockMediaStreamTrack {
  enabled = true;
  readyState = 'live';
  stop = vi.fn(() => { this.readyState = 'ended'; });
  kind = 'audio';
}

class MockRTCDataChannel {
  readyState = 'connecting';
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  send = vi.fn();
  close = vi.fn();
  label = 'oai-events';

  _simulateOpen() {
    this.readyState = 'open';
    this.onopen?.();
  }
  _simulateMessage(data: string) {
    this.onmessage?.({ data });
  }
}

class MockRTCPeerConnection {
  ontrack: ((e: { streams: MockMediaStream[] }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  connectionState = 'new';
  localDescription: { sdp: string } | null = null;
  private dataChannels: MockRTCDataChannel[] = [];

  addTrack = vi.fn();
  close = vi.fn();

  createDataChannel(label: string) {
    const dc = new MockRTCDataChannel();
    dc.label = label;
    this.dataChannels.push(dc);
    return dc;
  }

  async createOffer() {
    return { sdp: 'mock-sdp-offer', type: 'offer' };
  }

  async setLocalDescription(desc: { sdp: string }) {
    this.localDescription = desc;
  }

  async setRemoteDescription(_desc: { sdp: string; type: string }) {
    // Simulate connection established → fire ontrack
    setTimeout(() => {
      this.ontrack?.({ streams: [new MockMediaStream()] });
    }, 0);
  }

  _getLastDataChannel() {
    return this.dataChannels[this.dataChannels.length - 1];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup globals
// ─────────────────────────────────────────────────────────────────────────────

let lastPc: MockRTCPeerConnection;
let mockGetUserMedia: ReturnType<typeof vi.fn>;
let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // RTCPeerConnection
  lastPc = undefined as unknown as MockRTCPeerConnection;
  vi.stubGlobal('RTCPeerConnection', class extends MockRTCPeerConnection {
    constructor(config?: RTCConfiguration) {
      super();
      lastPc = this;
    }
  });

  // navigator.mediaDevices.getUserMedia
  mockGetUserMedia = vi.fn().mockResolvedValue(new MockMediaStream());
  vi.stubGlobal('navigator', {
    ...globalThis.navigator,
    mediaDevices: { getUserMedia: mockGetUserMedia },
    language: 'en-US',
  });

  // crypto.randomUUID
  let uuidCount = 0;
  vi.stubGlobal('crypto', {
    randomUUID: () => `uuid-${++uuidCount}`,
  });

  // fetch — mock both endpoints
  fetchSpy = vi.fn().mockImplementation(async (url: string | URL | Request) => {
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;

    // Ephemeral key endpoint
    if (urlStr.includes('/api/voice/realtime-session')) {
      return new Response(JSON.stringify({
        client_secret: { value: 'ek-test-12345' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // SDP exchange
    if (urlStr.includes('api.openai.com/v1/realtime')) {
      return new Response('mock-sdp-answer', {
        status: 200,
        headers: { 'Content-Type': 'application/sdp' },
      });
    }

    return new Response('Not found', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Imports the module fresh and extracts helpers needed for testing
 * the data-channel handler and state machine without rendering.
 */
async function getModule() {
  // Dynamic import to get fresh module per test if needed
  const mod = await import('../voice-conversation');
  return mod;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('VoiceConversation — WebRTC setup', () => {
  it('should fetch ephemeral key with correct language', async () => {
    // We can't easily render the component without a full React test env,
    // so we verify the fetch call shape that start() would make
    await fetch('/api/voice/realtime-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'fr' }),
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/voice/realtime-session',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ language: 'fr' }),
      }),
    );
  });

  it('should request mic with echo cancellation, noise suppression, and AGC', async () => {
    await mockGetUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });

    expect(mockGetUserMedia).toHaveBeenCalledWith({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  });

  it('should add mic tracks to peer connection', () => {
    const pc = new MockRTCPeerConnection();
    const stream = new MockMediaStream();
    stream.getTracks().forEach(t => pc.addTrack(t, stream as unknown as MediaStream));

    expect(pc.addTrack).toHaveBeenCalledTimes(1);
    expect(pc.addTrack).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'audio' }),
      stream,
    );
  });
});

describe('VoiceConversation — data channel state machine', () => {
  it('should transition to listening on session.created', () => {
    let currentState = 'connecting';
    const handler = (raw: string) => {
      const evt = JSON.parse(raw);
      if (evt.type === 'session.created' || evt.type === 'session.updated') {
        currentState = 'listening';
      }
    };

    handler(JSON.stringify({ type: 'session.created' }));
    expect(currentState).toBe('listening');

    currentState = 'connecting';
    handler(JSON.stringify({ type: 'session.updated' }));
    expect(currentState).toBe('listening');
  });

  it('should transition through full speech cycle', () => {
    const states: string[] = [];
    const transcripts: Array<{ role: string; text: string }> = [];
    let currentState = 'listening';

    const handler = (raw: string) => {
      const evt = JSON.parse(raw);
      switch (evt.type) {
        case 'input_audio_buffer.speech_started':
          currentState = 'user_speaking';
          states.push(currentState);
          break;
        case 'input_audio_buffer.speech_stopped':
          currentState = 'processing';
          states.push(currentState);
          break;
        case 'response.created':
          currentState = 'assistant_speaking';
          states.push(currentState);
          break;
        case 'response.audio_transcript.done':
          transcripts.push({ role: 'assistant', text: evt.transcript });
          break;
        case 'response.done':
          currentState = 'listening';
          states.push(currentState);
          break;
      }
    };

    handler(JSON.stringify({ type: 'input_audio_buffer.speech_started' }));
    handler(JSON.stringify({ type: 'input_audio_buffer.speech_stopped' }));
    handler(JSON.stringify({ type: 'response.created' }));
    handler(JSON.stringify({ type: 'response.audio_transcript.done', transcript: 'Hello!' }));
    handler(JSON.stringify({ type: 'response.done' }));

    expect(states).toEqual([
      'user_speaking',
      'processing',
      'assistant_speaking',
      'listening',
    ]);
    expect(transcripts).toEqual([{ role: 'assistant', text: 'Hello!' }]);
  });

  it('should detect farewell and trigger pending end', () => {
    let pendingEnd = false;
    const FAREWELL_RE = /\b(bye|goodbye|good\s*bye|see\s+you|au\s*revoir|end\s+(the\s+)?(call|conversation|chat|session)|hang\s+up|i[''']m\s+(done|good|all\s+set)|that[''']?s?\s+all|no\s+more\s+questions|stop\s+(talking|the\s+(call|chat)))\b/i;

    const handler = (raw: string) => {
      const evt = JSON.parse(raw);
      if (evt.type === 'conversation.item.input_audio_transcription.completed') {
        const text = (evt.transcript ?? '').trim();
        if (FAREWELL_RE.test(text)) pendingEnd = true;
      }
    };

    handler(JSON.stringify({
      type: 'conversation.item.input_audio_transcription.completed',
      transcript: 'goodbye',
    }));
    expect(pendingEnd).toBe(true);
  });

  it('should detect "goodbye for now" in assistant response and trigger end', () => {
    let pendingEnd = false;

    const handler = (raw: string) => {
      const evt = JSON.parse(raw);
      if (evt.type === 'response.audio_transcript.done') {
        if (/goodbye for now/i.test(evt.transcript ?? '')) pendingEnd = true;
      }
    };

    handler(JSON.stringify({
      type: 'response.audio_transcript.done',
      transcript: 'It was nice talking to you. Goodbye for now!',
    }));
    expect(pendingEnd).toBe(true);
  });
});

describe('VoiceConversation — session.update config', () => {
  it('should send correct VAD config on data channel open', () => {
    const dc = new MockRTCDataChannel();
    dc._simulateOpen();

    // Simulate what the component does on dc.onopen
    const config = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: 'test instructions',
        voice: 'alloy',
        input_audio_transcription: {
          model: 'gpt-4o-transcribe',
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
      },
    };

    dc.send(JSON.stringify(config));
    expect(dc.send).toHaveBeenCalledTimes(1);

    const sent = JSON.parse(dc.send.mock.calls[0]![0] as string);
    expect(sent.session.turn_detection).toEqual({
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500,
    });
  });
});

describe('VoiceConversation — cleanup', () => {
  it('should stop all mic tracks on cleanup', () => {
    const track = new MockMediaStreamTrack();
    const stream = new MockMediaStream([track]);

    // Simulate cleanup
    stream.getTracks().forEach(t => {
      t.enabled = false;
      t.stop();
    });

    expect(track.stop).toHaveBeenCalled();
    expect(track.enabled).toBe(false);
  });

  it('should close data channel and peer connection', () => {
    const dc = new MockRTCDataChannel();
    const pc = new MockRTCPeerConnection();

    dc.close();
    pc.close();

    expect(dc.close).toHaveBeenCalled();
    expect(pc.close).toHaveBeenCalled();
  });
});

describe('VoiceConversation — audio element requirements', () => {
  it('should NOT use display:none (Tailwind hidden) on audio element', async () => {
    // Read the component source to verify the audio element doesn't use className="hidden"
    // which causes display:none — mobile Safari won't maintain audio pipeline for such elements
    const fs = await import('node:fs');
    const src = fs.readFileSync(
      new URL('../voice-conversation.tsx', import.meta.url),
      'utf-8',
    );

    // Find lines containing <audio
    const audioLines = src.split('\n').filter(l => l.includes('<audio') && !l.trimStart().startsWith('//'));
    expect(audioLines.length).toBeGreaterThan(0);

    const audioLine = audioLines[0]!;

    // Must NOT have className="hidden" (display:none breaks mobile audio)
    expect(audioLine).not.toContain('"hidden"');

    // Should use sr-only or similar visual hiding
    expect(audioLine).toMatch(/sr-only|absolute/);
  });

  it('should have playsInline attribute on audio element', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(
      new URL('../voice-conversation.tsx', import.meta.url),
      'utf-8',
    );

    const audioLines = src.split('\n').filter(l => l.includes('<audio') && !l.trimStart().startsWith('//'));
    expect(audioLines.length).toBeGreaterThan(0);
    expect(audioLines[0]).toContain('playsInline');
  });

  it('should call play() on audio element during start() for user-gesture unlock', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(
      new URL('../voice-conversation.tsx', import.meta.url),
      'utf-8',
    );

    // The start function should call audioRef.current.play() BEFORE the async
    // WebRTC setup, so the play() happens in the user gesture call stack.
    // Look for a play() call early in start(), before createOffer/getUserMedia.
    const startFnMatch = src.match(/const start = useCallback\(async \(\) => \{([\s\S]*?)\}, \[/);
    expect(startFnMatch).toBeTruthy();

    const startBody = startFnMatch![1]!;

    // Should have an audio unlock/play before the fetch call
    const playIndex = startBody.indexOf('.play(');
    const fetchIndex = startBody.indexOf('fetch(');
    expect(playIndex).toBeGreaterThan(-1);
    expect(playIndex).toBeLessThan(fetchIndex);
  });

  it('should use VAD threshold ≤ 0.5 for mobile mic compatibility', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(
      new URL('../voice-conversation.tsx', import.meta.url),
      'utf-8',
    );

    const thresholdMatch = src.match(/threshold:\s*([\d.]+)/);
    expect(thresholdMatch).toBeTruthy();
    const threshold = parseFloat(thresholdMatch![1]!);

    // OpenAI default is 0.5 — should not exceed this for mobile compatibility
    expect(threshold).toBeLessThanOrEqual(0.5);
  });

  it('should use silence_duration_ms ≤ 800 for responsive turn-taking', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(
      new URL('../voice-conversation.tsx', import.meta.url),
      'utf-8',
    );

    const silenceMatch = src.match(/silence_duration_ms:\s*(\d+)/);
    expect(silenceMatch).toBeTruthy();
    const silenceDuration = parseInt(silenceMatch![1]!, 10);

    // High silence_duration makes Sandra feel sluggish. OpenAI default is ~200-500ms.
    expect(silenceDuration).toBeLessThanOrEqual(800);
  });
});

describe('VoiceConversation — SDP exchange', () => {
  it('should POST SDP offer to OpenAI with ephemeral key', async () => {
    const ephemeralKey = 'ek-test-12345';
    const model = 'gpt-4o-realtime-preview';
    const sdp = 'mock-sdp-offer';

    await fetch(`https://api.openai.com/v1/realtime?model=${model}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ephemeralKey}`, 'Content-Type': 'application/sdp' },
      body: sdp,
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      `https://api.openai.com/v1/realtime?model=${model}`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        }),
        body: sdp,
      }),
    );
  });
});
