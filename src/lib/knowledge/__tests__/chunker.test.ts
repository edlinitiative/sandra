import { describe, it, expect } from 'vitest';
import { chunkDocument } from '../chunker';
import type { RawDocument } from '../types';

function makeDoc(content: string): RawDocument {
  return { sourceId: 'src_1', title: 'Test Doc', content };
}

describe('chunkDocument', () => {
  it('returns empty array for empty content', () => {
    expect(chunkDocument(makeDoc(''))).toEqual([]);
    expect(chunkDocument(makeDoc('   '))).toEqual([]);
  });

  it('returns single chunk for short document', () => {
    const chunks = chunkDocument(makeDoc('Short document content'), { chunkSize: 1000 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe('Short document content');
    expect(chunks[0]?.chunkIndex).toBe(0);
    expect(chunks[0]?.chunkTotal).toBe(1);
  });

  it('assigns sourceId and title from document', () => {
    const chunks = chunkDocument(makeDoc('Hello world'));
    expect(chunks[0]?.sourceId).toBe('src_1');
    expect(chunks[0]?.title).toBe('Test Doc');
  });

  it('includes contentHash for each chunk', () => {
    const chunks = chunkDocument(makeDoc('Hello world'));
    expect(chunks[0]?.contentHash).toMatch(/^[a-f0-9]{16}$/);
  });

  it('splits a 3000-char document into multiple chunks', () => {
    const longText = 'Word '.repeat(600); // ~3000 chars
    const chunks = chunkDocument(makeDoc(longText), { chunkSize: 1000, chunkOverlap: 100 });
    expect(chunks.length).toBeGreaterThanOrEqual(3);
  });

  it('each chunk does not exceed chunkSize (within tolerance)', () => {
    const longText = 'A'.repeat(5000);
    const chunks = chunkDocument(makeDoc(longText), { chunkSize: 1000, chunkOverlap: 100 });
    for (const chunk of chunks) {
      // Allow some tolerance for overlap
      expect(chunk.content.length).toBeLessThanOrEqual(1200);
    }
  });

  it('chunkIndex and chunkTotal are consistent', () => {
    const longText = 'Word '.repeat(600);
    const chunks = chunkDocument(makeDoc(longText), { chunkSize: 500, chunkOverlap: 50 });
    expect(chunks.length).toBeGreaterThan(1);
    const total = chunks[0]?.chunkTotal ?? 0;
    chunks.forEach((c, i) => {
      expect(c.chunkIndex).toBe(i);
      expect(c.chunkTotal).toBe(total);
    });
  });

  describe('markdown heading context', () => {
    it('captures heading context for sections', () => {
      const md = `# Introduction

This is the intro paragraph.

# Features

Here are the features.`;

      const chunks = chunkDocument(makeDoc(md), { chunkSize: 2000 });
      // Should produce chunks with heading context
      const headings = chunks.map((c) => (c.metadata as { headingContext?: string })?.headingContext ?? '');
      expect(headings.some((h) => h.includes('Introduction'))).toBe(true);
      expect(headings.some((h) => h.includes('Features'))).toBe(true);
    });

    it('sets empty heading context when no headings', () => {
      const md = 'Just plain text content\nwithout any headings.';
      const chunks = chunkDocument(makeDoc(md), { chunkSize: 2000 });
      expect(chunks[0]?.metadata).toBeDefined();
      const headingCtx = (chunks[0]?.metadata as { headingContext?: string })?.headingContext;
      expect(headingCtx).toBe('');
    });

    it('3000-char markdown with headings produces multiple chunks with headingContext', () => {
      const md = `# Section 1

${'Content for section 1. '.repeat(50)}

# Section 2

${'Content for section 2. '.repeat(50)}

# Section 3

${'Content for section 3. '.repeat(50)}`;

      const chunks = chunkDocument(makeDoc(md), { chunkSize: 800, chunkOverlap: 100 });
      expect(chunks.length).toBeGreaterThanOrEqual(3);

      for (const chunk of chunks) {
        const headingCtx = (chunk.metadata as { headingContext?: string })?.headingContext;
        expect(headingCtx).toBeDefined();
      }
    });
  });
});
