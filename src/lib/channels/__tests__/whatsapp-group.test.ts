import { describe, it, expect } from 'vitest';
import { isSandraMentioned, stripMention, buildGroupSessionId, formatGroupContext } from '../whatsapp-group';

describe('isSandraMentioned', () => {
  it('detects "Sandra" at the start of a message', () => {
    expect(isSandraMentioned('Sandra what is the ESLP schedule?')).toBe(true);
  });

  it('detects "@Sandra" at the start', () => {
    expect(isSandraMentioned('@Sandra find the handbook')).toBe(true);
  });

  it('detects "sandra" case-insensitively', () => {
    expect(isSandraMentioned('SANDRA help me')).toBe(true);
    expect(isSandraMentioned('sAnDrA yo')).toBe(true);
  });

  it('detects "hey sandra" prefix', () => {
    expect(isSandraMentioned('Hey Sandra, what time is the meeting?')).toBe(true);
  });

  it('detects "hi sandra" prefix', () => {
    expect(isSandraMentioned('Hi Sandra can you check?')).toBe(true);
  });

  it('detects Sandra in the middle of a message', () => {
    expect(isSandraMentioned('Can you help me Sandra?')).toBe(true);
  });

  it('detects Sandra with trailing punctuation', () => {
    expect(isSandraMentioned('Sandra!')).toBe(true);
    expect(isSandraMentioned('Sandra?')).toBe(true);
    expect(isSandraMentioned('@Sandra.')).toBe(true);
  });

  it('does NOT trigger on "Alexandra" or "Sandraville"', () => {
    expect(isSandraMentioned('Alexandra is coming to the meeting')).toBe(false);
  });

  it('does NOT trigger on random messages', () => {
    expect(isSandraMentioned('what time is the meeting tomorrow?')).toBe(false);
    expect(isSandraMentioned('lets go guys')).toBe(false);
    expect(isSandraMentioned('')).toBe(false);
  });

  it('detects just "Sandra" as the entire message', () => {
    expect(isSandraMentioned('Sandra')).toBe(true);
    expect(isSandraMentioned('@sandra')).toBe(true);
  });
});

describe('stripMention', () => {
  it('strips "@Sandra " from the start', () => {
    expect(stripMention('@Sandra what is ESLP?')).toBe('what is ESLP?');
  });

  it('strips "Sandra, " from the start', () => {
    expect(stripMention('Sandra, find the handbook')).toBe('find the handbook');
  });

  it('strips "Hey Sandra " from the start', () => {
    expect(stripMention('Hey Sandra what time?')).toBe('what time?');
  });

  it('returns original text if stripping would empty it', () => {
    expect(stripMention('Sandra')).toBe('Sandra');
  });

  it('handles empty string', () => {
    expect(stripMention('')).toBe('');
  });

  it('does not strip Sandra from the middle', () => {
    const msg = 'Can Sandra help?';
    expect(stripMention(msg)).toBe(msg);
  });
});

describe('buildGroupSessionId', () => {
  it('creates a deterministic session id from group id', () => {
    expect(buildGroupSessionId('120363001234567890@g.us')).toBe('whatsapp-group:120363001234567890@g.us');
  });
});

describe('formatGroupContext', () => {
  it('formats with display name', () => {
    const ctx = formatGroupContext('Rony', '50912345678', 'grp123');
    expect(ctx).toContain('Rony');
    expect(ctx).toContain('Group chat');
  });

  it('formats with redacted phone when no name', () => {
    const ctx = formatGroupContext(undefined, '50912345678', 'grp123');
    expect(ctx).toContain('+5091');
    expect(ctx).not.toContain('50912345678');
  });
});
