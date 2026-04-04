/**
 * Tests for POST /api/chat/feedback
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockSubmitFeedback = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/feedback', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/feedback')>();
  return {
    ...actual,
    submitFeedback: (...a: unknown[]) => mockSubmitFeedback(...a),
  };
});

beforeEach(() => vi.clearAllMocks());

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/chat/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/chat/feedback', () => {
  it('returns 200 for valid thumbs-up', async () => {
    const { POST } = await import('../chat/feedback/route');
    const req = makeRequest({ sessionId: 'sess-1', messageRef: 'msg-1', rating: 'up' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.accepted).toBe(true);
    expect(mockSubmitFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'sess-1', messageRef: 'msg-1', rating: 'up' }),
    );
  });

  it('returns 200 for thumbs-down with comment', async () => {
    const { POST } = await import('../chat/feedback/route');
    const req = makeRequest({ sessionId: 'sess-1', messageRef: 'msg-2', rating: 'down', comment: 'Not accurate' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockSubmitFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ rating: 'down', comment: 'Not accurate' }),
    );
  });

  it('returns 400 when rating is missing', async () => {
    const { POST } = await import('../chat/feedback/route');
    const req = makeRequest({ sessionId: 'sess-1', messageRef: 'msg-1' });
    const res = await POST(req);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(mockSubmitFeedback).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid rating value', async () => {
    const { POST } = await import('../chat/feedback/route');
    const req = makeRequest({ sessionId: 'sess-1', messageRef: 'msg-1', rating: 'meh' });
    const res = await POST(req);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('returns 400 when sessionId is missing', async () => {
    const { POST } = await import('../chat/feedback/route');
    const req = makeRequest({ messageRef: 'msg-1', rating: 'up' });
    const res = await POST(req);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('returns 400 for non-JSON body', async () => {
    const { POST } = await import('../chat/feedback/route');
    const req = new Request('http://localhost/api/chat/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('returns 500 when submitFeedback throws', async () => {
    mockSubmitFeedback.mockRejectedValue(new Error('DB unavailable'));
    const { POST } = await import('../chat/feedback/route');
    const req = makeRequest({ sessionId: 'sess-1', messageRef: 'msg-1', rating: 'up' });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it('response includes requestId in meta', async () => {
    const { POST } = await import('../chat/feedback/route');
    const req = makeRequest({ sessionId: 'sess-1', messageRef: 'msg-1', rating: 'up' });
    const res = await POST(req);
    const body = await res.json();
    expect(body).toHaveProperty('meta.requestId');
  });
});
