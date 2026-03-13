import { createHash } from 'crypto';
import { DEFAULT_CHUNK_SIZE, DEFAULT_CHUNK_OVERLAP } from '@/lib/config';
import type { RawDocument, DocumentChunk } from './types';

/**
 * Split a document into overlapping chunks with markdown heading awareness.
 * Tracks the heading context (most recent heading above each chunk).
 */
export function chunkDocument(
  doc: RawDocument,
  options?: { chunkSize?: number; chunkOverlap?: number },
): DocumentChunk[] {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options?.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP;

  const text = doc.content.trim();
  if (!text) return [];

  // Parse document into sections by heading
  const sections = parseMarkdownSections(text);

  // Collect raw chunks with heading context
  const rawChunks: Array<{ content: string; headingContext: string }> = [];

  for (const section of sections) {
    const sectionText = section.content.trim();
    if (!sectionText) continue;

    if (sectionText.length <= chunkSize) {
      rawChunks.push({ content: sectionText, headingContext: section.heading });
    } else {
      // Split long sections by paragraph, then by characters if needed
      const subChunks = splitLongSection(sectionText, chunkSize, overlap);
      for (const sub of subChunks) {
        rawChunks.push({ content: sub, headingContext: section.heading });
      }
    }
  }

  if (rawChunks.length === 0) return [];

  const chunkTotal = rawChunks.length;
  return rawChunks.map((raw, index) => ({
    sourceId: doc.sourceId,
    documentId: doc.id,
    title: doc.title,
    path: doc.path,
    content: raw.content,
    chunkIndex: index,
    chunkTotal,
    contentHash: hashContent(raw.content),
    metadata: {
      ...doc.metadata,
      headingContext: raw.headingContext,
    },
  }));
}

/** A section parsed from a markdown document */
interface MarkdownSection {
  heading: string; // Most recent heading above this content (may be empty string)
  content: string;
}

/**
 * Parse a markdown document into sections, tracking the current heading context.
 * Each heading starts a new section; content between headings belongs to the
 * most recent heading above it.
 */
function parseMarkdownSections(text: string): MarkdownSection[] {
  const lines = text.split('\n');
  const sections: MarkdownSection[] = [];

  let currentHeading = '';
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      // Flush accumulated content under previous heading
      const accumulated = currentLines.join('\n').trim();
      if (accumulated) {
        sections.push({ heading: currentHeading, content: accumulated });
      }
      // Start new section under this heading
      currentHeading = line.trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  // Flush remaining content
  const remaining = currentLines.join('\n').trim();
  if (remaining) {
    sections.push({ heading: currentHeading, content: remaining });
  }

  // If no sections were produced (no headings), return the whole text as one section
  if (sections.length === 0) {
    sections.push({ heading: '', content: text.trim() });
  }

  return sections;
}

/**
 * Split a long text section into overlapping chunks.
 * Tries paragraph boundaries first, falls back to character splitting.
 */
function splitLongSection(text: string, chunkSize: number, overlap: number): string[] {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      const overlapText = current.slice(-overlap);
      current = overlapText + '\n\n' + para;
    } else {
      current = current ? current + '\n\n' + para : para;
    }
  }
  if (current.trim()) {
    chunks.push(current.trim());
  }

  // If paragraph splitting produced only one chunk but text is too long, use char splitting
  if (chunks.length === 1 && text.length > chunkSize) {
    return splitByCharacters(text, chunkSize, overlap);
  }

  return chunks.length > 0 ? chunks : [text];
}

function splitByCharacters(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  // Prevent infinite loops when overlap is >= chunkSize
  const safeOverlap = Math.min(overlap, chunkSize - 1);

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));

    if (end === text.length) break;

    start = end - safeOverlap;
  }

  return chunks;
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}
