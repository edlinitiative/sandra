/**
 * Tests for the capability gap detector (src/lib/learning/capability-gap.ts).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── DB mock ─────────────────────────────────────────────────────────────────

const mockCreate = vi.fn().mockResolvedValue({});

vi.mock('@/lib/db', () => ({
  db: {
    capabilityGap: {
      create: (...a: unknown[]) => mockCreate(...a),
    },
  },
}));

vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return {
    ...actual,
    createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  };
});

import { detectCapabilityGap, detectAndRecordCapabilityGap } from '../capability-gap';

beforeEach(() => vi.clearAllMocks());

// ─── detectCapabilityGap — English ───────────────────────────────────────────

describe('detectCapabilityGap — English', () => {
  it('returns false for a pure knowledge question', () => {
    const result = detectCapabilityGap('What is the capital of Haiti?');
    expect(result.isCapabilityGap).toBe(false);
    expect(result.matchedPatterns).toHaveLength(0);
  });

  it('detects "can you send an email"', () => {
    const result = detectCapabilityGap('Can you send an email to the teacher?');
    expect(result.isCapabilityGap).toBe(true);
    expect(result.matchedPatterns).toContain('request:send_message');
  });

  it('detects "can you create a form"', () => {
    const result = detectCapabilityGap('Can you create a form for the survey?');
    expect(result.isCapabilityGap).toBe(true);
    expect(result.matchedPatterns).toContain('request:create');
  });

  it('detects "can you schedule a meeting"', () => {
    const result = detectCapabilityGap('Could you schedule a meeting with my advisor?');
    expect(result.isCapabilityGap).toBe(true);
    expect(result.matchedPatterns).toContain('request:schedule');
  });

  it('detects "please send" imperative', () => {
    const result = detectCapabilityGap('Please send the report to my professor');
    expect(result.isCapabilityGap).toBe(true);
    expect(result.matchedPatterns).toContain('imperative:send_message');
  });

  it('detects "I need you to add"', () => {
    const result = detectCapabilityGap('I need you to add John to the calendar event');
    expect(result.isCapabilityGap).toBe(true);
    expect(result.matchedPatterns).toContain('need:action');
  });

  it('detects "book a meeting" direct verb', () => {
    const result = detectCapabilityGap('Book a meeting with the department head');
    expect(result.isCapabilityGap).toBe(true);
    expect(result.matchedPatterns).toContain('direct:schedule_meeting');
  });

  it('can match multiple patterns', () => {
    const result = detectCapabilityGap('Can you please schedule a meeting and send an email?');
    expect(result.isCapabilityGap).toBe(true);
    expect(result.matchedPatterns.length).toBeGreaterThan(1);
  });
});

// ─── detectCapabilityGap — French ────────────────────────────────────────────

describe('detectCapabilityGap — French', () => {
  it('detects "peux-tu envoyer"', () => {
    const result = detectCapabilityGap('Peux-tu envoyer ce document au professeur?');
    expect(result.isCapabilityGap).toBe(true);
    expect(result.matchedPatterns).toContain('fr:request');
  });

  it('detects "pouvez-vous créer"', () => {
    const result = detectCapabilityGap('Pouvez-vous créer un formulaire pour moi?');
    expect(result.isCapabilityGap).toBe(true);
    expect(result.matchedPatterns).toContain('fr:formal_request');
  });

  it('returns false for French knowledge question', () => {
    const result = detectCapabilityGap("Quelle est la capitale d'Haïti?");
    expect(result.isCapabilityGap).toBe(false);
  });
});

// ─── detectCapabilityGap — Haitian Creole ────────────────────────────────────

describe('detectCapabilityGap — Haitian Creole', () => {
  it('detects "eske ou kapab voye"', () => {
    const result = detectCapabilityGap('Eske ou kapab voye yon imèl bay pwofesè a?');
    expect(result.isCapabilityGap).toBe(true);
    expect(result.matchedPatterns).toContain('ht:request');
  });

  it('detects "sil ou plè fè"', () => {
    const result = detectCapabilityGap('Sil ou plè fè yon reyinyon pou mwen');
    expect(result.isCapabilityGap).toBe(true);
    expect(result.matchedPatterns).toContain('ht:imperative');
  });
});

// ─── detectAndRecordCapabilityGap ─────────────────────────────────────────────

describe('detectAndRecordCapabilityGap', () => {
  const base = {
    sessionId: 'sess-xyz',
    userId: 'user-2',
    channel: 'whatsapp' as const,
    language: 'en',
    message: 'Can you send an email to my tutor?',
  };

  it('writes to DB when an action request is detected', async () => {
    await detectAndRecordCapabilityGap(base);
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sessionId: 'sess-xyz',
          userId: 'user-2',
          channel: 'whatsapp',
          language: 'en',
          userMessage: base.message,
          patterns: expect.arrayContaining(['request:send_message']),
        }),
      }),
    );
  });

  it('is a no-op for knowledge questions (no action pattern)', async () => {
    await detectAndRecordCapabilityGap({
      ...base,
      message: 'What is the enrolment deadline?',
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('truncates long messages to 1000 chars', async () => {
    const longMsg = 'Can you send ' + 'x'.repeat(1200);
    await detectAndRecordCapabilityGap({ ...base, message: longMsg });
    const { data } = mockCreate.mock.calls[0]![0]!;
    expect(data.userMessage.length).toBe(1000);
  });

  it('never throws even if the DB write fails', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Connection lost'));
    await expect(
      detectAndRecordCapabilityGap(base),
    ).resolves.toBeUndefined();
  });

  it('works without optional userId / channel', async () => {
    await detectAndRecordCapabilityGap({
      sessionId: 'sess-anon',
      message: 'Please schedule a meeting',
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sessionId: 'sess-anon',
          userId: undefined,
          channel: undefined,
        }),
      }),
    );
  });
});
