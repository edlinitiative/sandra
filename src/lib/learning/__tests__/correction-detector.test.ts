/**
 * Tests for the correction detector (src/lib/learning/correction-detector.ts).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── DB mock ─────────────────────────────────────────────────────────────────

const mockCreate = vi.fn().mockResolvedValue({});

vi.mock('@/lib/db', () => ({
  db: {
    knowledgeCorrection: {
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

import { detectCorrection, detectAndRecordCorrection } from '../correction-detector';

beforeEach(() => vi.clearAllMocks());

// ─── detectCorrection — English ───────────────────────────────────────────────

describe('detectCorrection — English', () => {
  it('returns false for a neutral message', () => {
    const result = detectCorrection('Thanks for the information!');
    expect(result.isCorrection).toBe(false);
    expect(result.matchedPatterns).toHaveLength(0);
  });

  it('detects "that\'s wrong"', () => {
    const result = detectCorrection("That's wrong, the capital is Port-au-Prince");
    expect(result.isCorrection).toBe(true);
    expect(result.matchedPatterns).toContain('en:thats_wrong');
  });

  it('detects "you\'re incorrect"', () => {
    const result = detectCorrection("You're incorrect about the date");
    expect(result.isCorrection).toBe(true);
    expect(result.matchedPatterns).toContain('en:youre_wrong');
  });

  it('detects "actually it\'s"', () => {
    const result = detectCorrection("Actually it's not 2024, it's 2025");
    expect(result.isCorrection).toBe(true);
    expect(result.matchedPatterns).toContain('en:actually');
  });

  it('detects "no, that\'s not accurate"', () => {
    const result = detectCorrection("No, that's not accurate — please check again");
    expect(result.isCorrection).toBe(true);
  });

  it('detects "that information is incorrect"', () => {
    const result = detectCorrection('That information is incorrect');
    expect(result.isCorrection).toBe(true);
    expect(result.matchedPatterns).toContain('en:that_info_wrong');
  });

  it('can match multiple patterns at once', () => {
    const result = detectCorrection("You're wrong, actually it's something else");
    expect(result.isCorrection).toBe(true);
    expect(result.matchedPatterns.length).toBeGreaterThan(1);
  });
});

// ─── detectCorrection — French ────────────────────────────────────────────────

describe('detectCorrection — French', () => {
  it('detects "c\'est faux"', () => {
    const result = detectCorrection("C'est faux, veuillez vérifier");
    expect(result.isCorrection).toBe(true);
    expect(result.matchedPatterns).toContain('fr:cest_faux');
  });

  it('detects "tu as tort"', () => {
    const result = detectCorrection('Tu as tort à ce sujet');
    expect(result.isCorrection).toBe(true);
    expect(result.matchedPatterns).toContain('fr:tu_as_tort');
  });

  it('detects "en fait"', () => {
    const result = detectCorrection('En fait, la réponse est différente');
    expect(result.isCorrection).toBe(true);
    expect(result.matchedPatterns).toContain('fr:en_fait');
  });
});

// ─── detectCorrection — Haitian Creole ───────────────────────────────────────

describe('detectCorrection — Haitian Creole', () => {
  it('detects "sa pa bon"', () => {
    const result = detectCorrection('Sa pa bon, tanpri korije');
    expect(result.isCorrection).toBe(true);
    expect(result.matchedPatterns).toContain('ht:sa_pa_bon');
  });

  it('detects "ou pa gen rezon"', () => {
    const result = detectCorrection('Ou pa gen rezon sou sa');
    expect(result.isCorrection).toBe(true);
    expect(result.matchedPatterns).toContain('ht:ou_pa_gen_rezon');
  });
});

// ─── detectAndRecordCorrection ────────────────────────────────────────────────

describe('detectAndRecordCorrection', () => {
  const base = {
    sessionId: 'sess-abc',
    userId: 'user-1',
    language: 'en',
    message: "That's wrong, the answer is 42",
    priorResponse: 'The answer is 41.',
  };

  it('writes to DB when a correction is detected', async () => {
    await detectAndRecordCorrection(base);
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sessionId: 'sess-abc',
          userId: 'user-1',
          language: 'en',
          userMessage: base.message,
          priorResponse: base.priorResponse,
          patterns: expect.arrayContaining(['en:thats_wrong']),
        }),
      }),
    );
  });

  it('is a no-op for non-correction messages', async () => {
    await detectAndRecordCorrection({ ...base, message: 'Thanks, that makes sense!' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('truncates long priorResponse to 500 chars', async () => {
    const longPrior = 'x'.repeat(600);
    await detectAndRecordCorrection({ ...base, priorResponse: longPrior });
    const { data } = mockCreate.mock.calls[0][0];
    expect(data.priorResponse.length).toBe(500);
  });

  it('truncates long userMessage to 1000 chars', async () => {
    const longMessage = "That's wrong: " + 'y'.repeat(1200);
    await detectAndRecordCorrection({ ...base, message: longMessage });
    const { data } = mockCreate.mock.calls[0][0];
    expect(data.userMessage.length).toBe(1000);
  });

  it('never throws even if the DB write fails', async () => {
    mockCreate.mockRejectedValueOnce(new Error('DB down'));
    await expect(
      detectAndRecordCorrection(base),
    ).resolves.toBeUndefined();
  });

  it('works without optional userId / priorResponse', async () => {
    await detectAndRecordCorrection({
      sessionId: 'sess-anon',
      message: "That's incorrect",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sessionId: 'sess-anon', userId: undefined }),
      }),
    );
  });
});
