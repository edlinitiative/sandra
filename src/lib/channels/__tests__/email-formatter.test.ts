import { describe, it, expect } from 'vitest';
import {
  formatForEmail,
  buildEmailBody,
  extractEmailReply,
} from '../email-formatter';

describe('formatForEmail', () => {
  it('converts headings to uppercase', () => {
    expect(formatForEmail('## Overview')).toBe('OVERVIEW');
    expect(formatForEmail('# Main Title')).toBe('MAIN TITLE');
  });

  it('keeps h4-h6 as plain text', () => {
    expect(formatForEmail('#### Minor')).toBe('Minor');
  });

  it('strips **bold** markers', () => {
    expect(formatForEmail('This is **bold** text')).toBe('This is bold text');
  });

  it('strips *italic* markers', () => {
    expect(formatForEmail('This is *italic* text')).toBe('This is italic text');
  });

  it('strips inline code backticks', () => {
    expect(formatForEmail('run `npm install`')).toBe('run npm install');
  });

  it('converts fenced code blocks to --- markers', () => {
    const input = '```python\nprint("hello")\n```';
    const result = formatForEmail(input);
    expect(result).toContain('---');
    expect(result).toContain('print("hello")');
  });

  it('strips image markdown', () => {
    expect(formatForEmail('![alt](url) text')).toBe('text');
  });

  it('converts markdown links to label <url>', () => {
    expect(formatForEmail('[EdLight](https://edlight.com)')).toBe('EdLight <https://edlight.com>');
  });

  it('converts bullet lists to indented dashes', () => {
    const input = '- item one\n- item two';
    const result = formatForEmail(input);
    expect(result).toContain('  - item one');
    expect(result).toContain('  - item two');
  });

  it('collapses excessive blank lines (4+ → 3)', () => {
    const input = 'a\n\n\n\n\nb';
    const result = formatForEmail(input);
    expect(result).not.toMatch(/\n{4,}/);
  });

  it('passes through short plain text unchanged', () => {
    expect(formatForEmail('Hello Sandra')).toBe('Hello Sandra');
  });
});

describe('buildEmailBody', () => {
  it('appends default signature', () => {
    const result = buildEmailBody({ response: 'Here is your answer.' });
    expect(result).toContain('Sandra');
    expect(result).toContain('EdLight');
    expect(result).toContain('--');
  });

  it('appends custom signature', () => {
    const result = buildEmailBody({ response: 'Hi', signature: 'Custom Sig' });
    expect(result).toContain('Custom Sig');
  });

  it('formats the response through formatForEmail', () => {
    const result = buildEmailBody({ response: '## Report\n**Important**' });
    expect(result).toContain('REPORT');
    expect(result).not.toContain('**');
  });
});

describe('extractEmailReply', () => {
  it('returns full text when no quoted history', () => {
    const text = 'Hello Sandra, what are the programs?';
    expect(extractEmailReply(text)).toBe(text);
  });

  it('strips "On <date> wrote:" quoted sections', () => {
    const text = 'My question\n\nOn Mon Jan 01 2024 Alice wrote:\n> Some quoted text';
    const result = extractEmailReply(text);
    expect(result).toBe('My question');
  });

  it('strips lines starting with >', () => {
    const text = 'My reply\n> Quoted line\n> More quoted';
    const result = extractEmailReply(text);
    expect(result).toBe('My reply');
  });

  it('strips at --- separator', () => {
    const text = 'Fresh text\n-----\nOriginal message below';
    const result = extractEmailReply(text);
    expect(result).toBe('Fresh text');
  });

  it('trims trailing whitespace', () => {
    const text = 'Hello  \n\n';
    expect(extractEmailReply(text)).toBe('Hello');
  });
});
