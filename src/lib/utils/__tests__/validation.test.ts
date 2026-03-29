import { describe, it, expect } from 'vitest';
import { sanitizeInput, chatInputSchema, indexInputSchema, sessionIdSchema } from '../validation';

describe('sanitizeInput', () => {
  it('strips HTML tags', () => {
    expect(sanitizeInput('<script>alert("xss")</script>hello')).toBe('alert("xss")hello');
  });

  it('trims whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });

  it('strips nested tags', () => {
    expect(sanitizeInput('<b><i>bold italic</i></b>')).toBe('bold italic');
  });

  it('returns plain text unchanged (just trimmed)', () => {
    expect(sanitizeInput('hello world')).toBe('hello world');
  });
});

describe('chatInputSchema', () => {
  it('parses valid minimal input', () => {
    const result = chatInputSchema.parse({ message: 'hi' });
    expect(result.message).toBe('hi');
  });

  it('parses with optional fields', () => {
    const result = chatInputSchema.parse({
      message: 'hello',
      sessionId: '123e4567-e89b-12d3-a456-426614174000',
      userId: 'web:test-user-123',
      language: 'fr',
    });
    expect(result.language).toBe('fr');
    expect(result.sessionId).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(result.userId).toBe('web:test-user-123');
  });

  it('rejects empty message', () => {
    expect(() => chatInputSchema.parse({ message: '' })).toThrow();
  });

  it('rejects message over 4000 chars', () => {
    expect(() => chatInputSchema.parse({ message: 'x'.repeat(4001) })).toThrow();
  });

  it('rejects invalid language code', () => {
    expect(() => chatInputSchema.parse({ message: 'hi', language: 'de' })).toThrow();
  });

  it('rejects invalid sessionId (not uuid)', () => {
    expect(() => chatInputSchema.parse({ message: 'hi', sessionId: 'not-a-uuid' })).toThrow();
  });

  it('accepts all valid languages', () => {
    for (const lang of ['en', 'fr', 'ht']) {
      expect(() => chatInputSchema.parse({ message: 'hi', language: lang })).not.toThrow();
    }
  });
});

describe('indexInputSchema', () => {
  it('parses valid input', () => {
    const result = indexInputSchema.parse({ repoId: 'repo_123' });
    expect(result.repoId).toBe('repo_123');
  });

  it('accepts missing repoId for index-all requests', () => {
    const result = indexInputSchema.parse({});
    expect(result.repoId).toBeUndefined();
  });

  it('rejects empty repoId', () => {
    expect(() => indexInputSchema.parse({ repoId: '' })).toThrow();
  });
});

describe('sessionIdSchema', () => {
  it('accepts valid UUID', () => {
    expect(() =>
      sessionIdSchema.parse('123e4567-e89b-12d3-a456-426614174000'),
    ).not.toThrow();
  });

  it('rejects invalid UUID', () => {
    expect(() => sessionIdSchema.parse('not-a-uuid')).toThrow();
  });
});
