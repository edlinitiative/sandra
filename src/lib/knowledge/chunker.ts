import { createHash } from 'crypto';
import { DEFAULT_CHUNK_SIZE, DEFAULT_CHUNK_OVERLAP } from '@/lib/config';
import type { RawDocument, DocumentChunk } from './types';

/**
 * Split a document into overlapping chunks.
 * Uses a simple character-based strategy with paragraph awareness.
 */
export function chunkDocument(
  doc: RawDocument,
  options?: { chunkSize?: number; chunkOverlap?: number },
): DocumentChunk[] {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options?.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP;

  const text = doc.content.trim();
  if (!text) return [];

  // If the document fits in one chunk, return it as-is
  if (text.length <= chunkSize) {
    return [
      {
        sourceId: doc.sourceId,
        documentId: doc.id,
        title: doc.title,
        path: doc.path,
        content: text,
        chunkIndex: 0,
        chunkTotal: 1,
        contentHash: hashContent(text),
        metadata: doc.metadata,
      },
    ];
  }

  // Split into paragraphs first, then recombine into chunks
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      // Keep overlap from end of current chunk
      const overlapText = current.slice(-overlap);
      current = overlapText + '\n\n' + para;
    } else {
      current = current ? current + '\n\n' + para : para;
    }
  }
  if (current.trim()) {
    chunks.push(current.trim());
  }

  // If paragraph-based chunking produced only one chunk but text is long,
  // fall back to character-based splitting
  if (chunks.length === 1 && text.length > chunkSize) {
    return chunkByCharacters(doc, text, chunkSize, overlap);
  }

  return chunks.map((content, index) => ({
    sourceId: doc.sourceId,
    documentId: doc.id,
    title: doc.title,
    path: doc.path,
    content,
    chunkIndex: index,
    chunkTotal: chunks.length,
    contentHash: hashContent(content),
    metadata: doc.metadata,
  }));
}

function chunkByCharacters(
  doc: RawDocument,
  text: string,
  chunkSize: number,
  overlap: number,
): DocumentChunk[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
    if (start >= text.length) break;
  }

  return chunks.map((content, index) => ({
    sourceId: doc.sourceId,
    documentId: doc.id,
    title: doc.title,
    path: doc.path,
    content,
    chunkIndex: index,
    chunkTotal: chunks.length,
    contentHash: hashContent(content),
    metadata: doc.metadata,
  }));
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}
