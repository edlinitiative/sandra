export type {
  RawDocument,
  DocumentChunk,
  EmbeddedChunk,
  SearchResult,
  RetrieveContextOptions,
  KnowledgeSearchFilter,
  KnowledgePlatform,
  KnowledgeContentType,
  DocumentSourceType,
  IndexingStatus,
  DocumentSourceConfig,
  VectorStore,
} from './types';
export { chunkDocument } from './chunker';
export { embedChunks, embedQuery } from './embeddings';
export { InMemoryVectorStore, getVectorStore, setVectorStore } from './vector-store';
export { retrieveContext, formatRetrievalContext } from './retrieval';
export { ingestDocuments, removeSource } from './ingest';
export {
  searchPlatformKnowledge,
  inferKnowledgeQueryContext,
  extractCourseMatches,
  extractProgramMatches,
  buildGroundedDescription,
  extractHighlights,
  listGroundingSources,
  fallbackPlatformDescription,
} from './platform-knowledge';
export {
  normalizePlatform,
  platformFromRepo,
  repoIdForPlatform,
  displayNameForPlatform,
  deriveContentType,
  computePathPriority,
} from './platform-metadata';
