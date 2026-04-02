import { describe, it, expect } from 'vitest';
import {
  formatForVoice,
  estimateSpeakDuration,
  VOICE_MAX_LENGTH,
  VOICE_TRUNCATION_SUFFIX,
} from '../voice-formatter';

describe('formatForVoice', () => {
  it('passes plain text through unchanged', () => {
    expect(formatForVoice('Hello Sandra')).toBe('Hello Sandra');
  });

  it('strips image markdown', () => {
    expect(formatForVoice('![alt](url) text')).toBe('text');
  });

  it('replaces fenced code blocks with spoken placeholder', () => {
    const input = 'Here is code:\n```js\nconsole.log("hi");\n```\nDone.';
    const result = formatForVoice(input);
    expect(result).toContain('(code block omitted)');
    expect(result).not.toContain('console.log');
    expect(result).not.toContain('```');
  });

  it('strips inline code backticks (keeps text)', () => {
    expect(formatForVoice('Run `npm install` first')).toBe('Run npm install first');
  });

  it('strips heading markers', () => {
    expect(formatForVoice('## Introduction')).toBe('Introduction');
    expect(formatForVoice('### Section')).toBe('Section');
  });

  it('strips bold markers', () => {
    expect(formatForVoice('This is **important** text')).toBe('This is important text');
    expect(formatForVoice('This is __also bold__')).toBe('This is also bold');
  });

  it('strips italic markers', () => {
    expect(formatForVoice('This is *italic* text')).toBe('This is italic text');
    expect(formatForVoice('This is _also italic_')).toBe('This is also italic');
  });

  it('keeps only the label from markdown links (no URL)', () => {
    const result = formatForVoice('Visit [EdLight](https://edlight.com) today');
    expect(result).toBe('Visit EdLight today');
    expect(result).not.toContain('https://');
  });

  it('converts bullet lists to plain sentences', () => {
    const input = '- First item\n- Second item';
    const result = formatForVoice(input);
    expect(result).toContain('First item');
    expect(result).toContain('Second item');
    expect(result).not.toContain('- First');
  });

  it('collapses 3+ blank lines to a single break', () => {
    const input = 'a\n\n\n\nb';
    const result = formatForVoice(input);
    expect(result).not.toMatch(/\n{3,}/);
  });

  it('truncates long text near VOICE_MAX_LENGTH', () => {
    const long = 'This is a sentence. '.repeat(50);
    const result = formatForVoice(long);
    expect(result.length).toBeLessThan(long.length);
    expect(result).toContain(VOICE_TRUNCATION_SUFFIX);
  });

  it('does not truncate text within VOICE_MAX_LENGTH', () => {
    const short = 'Hello Sandra, how are you today?';
    expect(formatForVoice(short)).toBe(short);
  });

  it('strips leading newlines but preserves leading words', () => {
    const result = formatForVoice('\n\nHello');
    expect(result).toBe('Hello');
  });
});

describe('estimateSpeakDuration', () => {
  it('returns 0 for empty string', () => {
    expect(estimateSpeakDuration('')).toBe(0);
  });

  it('estimates duration for a known word count (150 wpm)', () => {
    // 75 words → 30 seconds at 150 wpm
    const text = 'word '.repeat(75).trim();
    expect(estimateSpeakDuration(text)).toBe(30);
  });

  it('rounds to nearest second', () => {
    // 1 word → 0.4s rounds to 0
    expect(estimateSpeakDuration('hello')).toBe(0);
    // 3 words → 1.2s rounds to 1
    expect(estimateSpeakDuration('one two three')).toBe(1);
  });

  it('handles the VOICE_MAX_LENGTH constant definition', () => {
    expect(VOICE_MAX_LENGTH).toBe(500);
  });
});
