import { describe, it, expect } from 'vitest';
import {
  formatForWhatsApp,
  splitForWhatsApp,
  buildTypingIndicatorText,
  WHATSAPP_MAX_LENGTH,
} from '../whatsapp-formatter';

describe('formatForWhatsApp', () => {
  it('converts markdown headings to WhatsApp bold', () => {
    expect(formatForWhatsApp('## Hello World')).toBe('*Hello World*');
    expect(formatForWhatsApp('# Title')).toBe('*Title*');
    expect(formatForWhatsApp('### Deep')).toBe('*Deep*');
  });

  it('converts **bold** to WhatsApp *bold*', () => {
    expect(formatForWhatsApp('This is **bold** text')).toBe('This is *bold* text');
  });

  it('converts __bold__ to WhatsApp *bold*', () => {
    expect(formatForWhatsApp('This is __bold__ text')).toBe('This is *bold* text');
  });

  it('strips inline code backticks', () => {
    expect(formatForWhatsApp('use `npm install`')).toBe('use npm install');
  });

  it('converts fenced code blocks to dividers', () => {
    const input = '```js\nconsole.log("hi");\n```';
    const result = formatForWhatsApp(input);
    expect(result).toContain('---');
    expect(result).toContain('console.log("hi");');
  });

  it('converts markdown links to text (url)', () => {
    expect(formatForWhatsApp('[EdLight](https://edlight.com)')).toBe('EdLight (https://edlight.com)');
  });

  it('strips image markdown', () => {
    expect(formatForWhatsApp('![alt](https://img.png) text')).toBe('text');
  });

  it('converts bullet lists to • prefix', () => {
    const input = '- item one\n- item two';
    const result = formatForWhatsApp(input);
    expect(result).toContain('• item one');
    expect(result).toContain('• item two');
  });

  it('collapses multiple blank lines to one', () => {
    const input = 'line one\n\n\n\nline two';
    const result = formatForWhatsApp(input);
    expect(result).not.toMatch(/\n{3,}/);
  });

  it('truncates at 4096 characters with suffix', () => {
    const longText = 'a'.repeat(5000);
    const result = formatForWhatsApp(longText);
    expect(result.length).toBeLessThanOrEqual(WHATSAPP_MAX_LENGTH);
    expect(result).toContain('truncated');
  });

  it('returns short text unchanged (except whitespace trim)', () => {
    const text = 'Hello from Sandra!';
    expect(formatForWhatsApp(text)).toBe(text);
  });

  it('passes through WhatsApp-native *bold* untouched', () => {
    const text = '*already bold*';
    expect(formatForWhatsApp(text)).toBe('*already bold*');
  });
});

describe('splitForWhatsApp', () => {
  it('returns single chunk for short messages', () => {
    const text = 'Short message';
    const chunks = splitForWhatsApp(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('Short message');
  });

  it('splits on paragraph boundaries respecting max length', () => {
    // Create a message that's ~3 paragraphs of 1600 chars each (> 4096 total)
    const para = 'A'.repeat(1500);
    const text = `${para}\n\n${para}\n\n${para}`;
    const chunks = splitForWhatsApp(text, 2000);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(2000);
    }
  });

  it('returns empty array for empty string', () => {
    expect(splitForWhatsApp('')).toEqual([]);
  });

  it('returns trimmed single chunk for whitespace-only', () => {
    const result = splitForWhatsApp('   \n\n  ');
    expect(result).toEqual([]);
  });

  it('handles text without paragraph breaks', () => {
    const text = 'x'.repeat(200);
    const chunks = splitForWhatsApp(text, 100);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(100);
    }
  });
});

describe('buildTypingIndicatorText', () => {
  it('returns emoji-prefixed label for known tools', () => {
    expect(buildTypingIndicatorText('searchKnowledgeBase')).toMatch(/🔍/);
    expect(buildTypingIndicatorText('getCourseInventory')).toMatch(/📚/);
    expect(buildTypingIndicatorText('getUserProfileSummary')).toMatch(/👤/);
  });

  it('returns a default indicator for unknown tools', () => {
    const result = buildTypingIndicatorText('unknown_tool_xyz');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
