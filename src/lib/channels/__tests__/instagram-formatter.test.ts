import { describe, it, expect } from 'vitest';
import {
  formatForInstagram,
  splitForInstagram,
  INSTAGRAM_MAX_LENGTH,
} from '../instagram-formatter';

describe('formatForInstagram', () => {
  it('strips markdown headings (no bold, just plain text)', () => {
    expect(formatForInstagram('## Hello World')).toBe('Hello World');
    expect(formatForInstagram('# Title')).toBe('Title');
  });

  it('strips **bold** markers', () => {
    expect(formatForInstagram('This is **bold** text')).toBe('This is bold text');
  });

  it('strips *italic* markers', () => {
    expect(formatForInstagram('This is *italic* text')).toBe('This is italic text');
  });

  it('strips inline code backticks', () => {
    expect(formatForInstagram('use `npm install`')).toBe('use npm install');
  });

  it('strips fenced code blocks, keeping content', () => {
    const input = '```js\nconsole.log("hi");\n```';
    const result = formatForInstagram(input);
    expect(result).toContain('console.log("hi");');
    expect(result).not.toContain('```');
  });

  it('converts markdown links to label: url', () => {
    expect(formatForInstagram('[EdLight](https://edlight.com)')).toBe('EdLight: https://edlight.com');
  });

  it('strips image markdown', () => {
    expect(formatForInstagram('![alt](https://img.png) text')).toBe('text');
  });

  it('converts bullet lists to • prefix', () => {
    const input = '- item one\n- item two';
    const result = formatForInstagram(input);
    expect(result).toContain('• item one');
    expect(result).toContain('• item two');
  });

  it('collapses multiple blank lines', () => {
    expect(formatForInstagram('a\n\n\n\nb')).not.toMatch(/\n{3,}/);
  });

  it('truncates at 1000 characters with suffix', () => {
    const longText = 'a'.repeat(1500);
    const result = formatForInstagram(longText);
    expect(result.length).toBeLessThanOrEqual(INSTAGRAM_MAX_LENGTH);
    expect(result).toContain('truncated');
  });

  it('passes through short plain text unchanged', () => {
    expect(formatForInstagram('Hello from Sandra!')).toBe('Hello from Sandra!');
  });
});

describe('splitForInstagram', () => {
  it('returns single chunk for short messages', () => {
    expect(splitForInstagram('Short message')).toEqual(['Short message']);
  });

  it('returns empty array for empty string', () => {
    expect(splitForInstagram('')).toEqual([]);
  });

  it('splits on paragraph boundaries for long messages', () => {
    const para = 'B'.repeat(600);
    const text = `${para}\n\n${para}`;
    const chunks = splitForInstagram(text, 700);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(700);
    }
  });

  it('hard-splits very long paragraphs', () => {
    const text = 'X'.repeat(2500);
    const chunks = splitForInstagram(text, 1000);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1000);
    }
  });
});
