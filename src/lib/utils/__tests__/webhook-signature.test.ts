import crypto from 'crypto';
import { describe, it, expect } from 'vitest';
import { verifyMetaSignature } from '../webhook-signature';

describe('verifyMetaSignature', () => {
  const appSecret = 'test-app-secret-abc123';
  const payload = '{"entry":[{"changes":[{"field":"messages"}]}]}';

  function sign(body: string, secret: string): string {
    const hash = crypto.createHmac('sha256', secret).update(body).digest('hex');
    return `sha256=${hash}`;
  }

  it('returns true for a valid signature', () => {
    const signature = sign(payload, appSecret);
    expect(verifyMetaSignature(payload, signature, appSecret)).toBe(true);
  });

  it('returns false for a tampered payload', () => {
    const signature = sign(payload, appSecret);
    const tampered = payload + ' ';
    expect(verifyMetaSignature(tampered, signature, appSecret)).toBe(false);
  });

  it('returns false for wrong secret', () => {
    const signature = sign(payload, 'wrong-secret');
    expect(verifyMetaSignature(payload, signature, appSecret)).toBe(false);
  });

  it('returns false for missing signature header', () => {
    expect(verifyMetaSignature(payload, null, appSecret)).toBe(false);
  });

  it('returns false for invalid signature format (no sha256= prefix)', () => {
    expect(verifyMetaSignature(payload, 'md5=abc123', appSecret)).toBe(false);
  });

  it('returns true (skip) when app secret is empty string', () => {
    const signature = sign(payload, appSecret);
    expect(verifyMetaSignature(payload, signature, '')).toBe(true);
  });

  it('works with Buffer input', () => {
    const buf = Buffer.from(payload, 'utf-8');
    const signature = sign(payload, appSecret);
    expect(verifyMetaSignature(buf, signature, appSecret)).toBe(true);
  });
});
