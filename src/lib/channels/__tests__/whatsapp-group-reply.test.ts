import { describe, it, expect } from 'vitest';
import { isReplyToSandra } from '../whatsapp-group';

describe('isReplyToSandra', () => {
  it('returns true when contextFrom matches businessPhoneNumber exactly', () => {
    expect(isReplyToSandra({
      contextFrom: '15551234567',
      businessPhoneNumber: '15551234567',
    })).toBe(true);
  });

  it('returns true when contextFrom matches after normalization (with +)', () => {
    expect(isReplyToSandra({
      contextFrom: '+15551234567',
      businessPhoneNumber: '15551234567',
    })).toBe(true);
  });

  it('returns true when businessPhoneNumber has + prefix', () => {
    expect(isReplyToSandra({
      contextFrom: '15551234567',
      businessPhoneNumber: '+1 555 123 4567',
    })).toBe(true);
  });

  it('returns true with suffix matching (country code difference)', () => {
    // WhatsApp might store the number differently
    expect(isReplyToSandra({
      contextFrom: '15551234567',
      businessPhoneNumber: '5551234567',
    })).toBe(true);
  });

  it('returns true with suffix matching (reverse direction)', () => {
    expect(isReplyToSandra({
      contextFrom: '5551234567',
      businessPhoneNumber: '15551234567',
    })).toBe(true);
  });

  it('returns false when contextFrom is a different number', () => {
    expect(isReplyToSandra({
      contextFrom: '15559876543',
      businessPhoneNumber: '15551234567',
    })).toBe(false);
  });

  it('returns false when contextFrom is null', () => {
    expect(isReplyToSandra({
      contextFrom: null,
      businessPhoneNumber: '15551234567',
    })).toBe(false);
  });

  it('returns false when businessPhoneNumber is null', () => {
    expect(isReplyToSandra({
      contextFrom: '15551234567',
      businessPhoneNumber: null,
    })).toBe(false);
  });

  it('returns false when metadata is undefined', () => {
    expect(isReplyToSandra(undefined)).toBe(false);
  });

  it('returns false when both fields are missing', () => {
    expect(isReplyToSandra({})).toBe(false);
  });

  it('returns false when contextFrom is empty string', () => {
    expect(isReplyToSandra({
      contextFrom: '',
      businessPhoneNumber: '15551234567',
    })).toBe(false);
  });

  it('handles numbers with dashes and spaces', () => {
    expect(isReplyToSandra({
      contextFrom: '1-555-123-4567',
      businessPhoneNumber: '+1 (555) 123-4567',
    })).toBe(true);
  });
});
