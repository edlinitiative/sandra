/**
 * Knowledge/RAG system type definitions.
 */

/** A document before chunking */
export interface RawDocument {
  id?: string;
  sourceId: string;
  title: string;
  path?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/** A chunk of a document ready for embedding */
export interface DocumentChunk {
  id?: string;
  sourceId: string;
  documentId?: string;
  title?: string;
  path?: string;
  content: string;
  chunkIndex: number;
  chunkTotal: number;
  contentHash: string;
  metadata?: Record<string, unknown>;
}

/** A chunk with its embedding vector */
export interface EmbeddedChunk extends DocumentChunk {
  embedding: number[];
}

/** A search result from the vector store */
export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
  embedding?: number[];
}

export type KnowledgePlatform = 'academy' | 'code' | 'news' | 'initiative';

export type KnowledgeContentType =
  | 'course'
  | 'program'
  | 'news'
  | 'documentation'
  | 'repo_readme'
  | 'code'
  | 'general';

export interface KnowledgeSearchFilter {
  sourceId?: string;
  platform?: KnowledgePlatform | string;
  repo?: string;
  contentType?: KnowledgeContentType | KnowledgeContentType[] | string;
  preferPaths?: string[];
}

export interface RetrieveContextOptions {
  topK?: number;
  minScore?: number;
  filter?: KnowledgeSearchFilter;
}

/** Source types for indexed content */
export type DocumentSourceType = 'github_repo' | 'website' | 'document' | 'manual';

/** Status of an indexed source */
export type IndexingStatus = 'pending' | 'indexing' | 'indexed' | 'error';

/** Configuration for a document source */
export interface DocumentSourceConfig {
  name: string;
  type: DocumentSourceType;
  url?: string;
  metadata?: Record<string, unknown>;
}

/** Interface for the vector store backend */
export interface VectorStore {
  /** Insert embedded chunks */
  upsert(chunks: EmbeddedChunk[]): Promise<void>;

  /** Search for similar chunks */
  search(query: number[], topK?: number, filter?: KnowledgeSearchFilter): Promise<SearchResult[]>;

  /** Delete chunks by source ID */
  deleteBySource(sourceId: string): Promise<void>;

  /** Get total count of stored chunks */
  count(sourceId?: string): Promise<number>;

  /** Health check */
  isReady(): Promise<boolean>;
}
