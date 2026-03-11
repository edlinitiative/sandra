/**
 * Application-wide constants.
 */

export const APP_NAME = 'Sandra';
export const APP_DESCRIPTION = 'AI assistant for the EdLight ecosystem';
export const APP_VERSION = '0.1.0';

/** Maximum tokens for a single agent response */
export const MAX_RESPONSE_TOKENS = 2048;

/** Maximum messages to include in context window */
export const MAX_CONTEXT_MESSAGES = 20;

/** Chunk size for document splitting (characters) */
export const DEFAULT_CHUNK_SIZE = 1000;

/** Overlap between chunks (characters) */
export const DEFAULT_CHUNK_OVERLAP = 200;

/** Maximum results from vector search */
export const DEFAULT_TOP_K = 5;

/** Embedding dimension for text-embedding-3-small */
export const EMBEDDING_DIMENSION = 1536;

/** Supported EdLight platforms */
export const EDLIGHT_PLATFORMS = [
  'EdLight Code',
  'EdLight Academy',
  'EdLight News',
  'EdLight Initiative',
] as const;

export type EdLightPlatform = (typeof EDLIGHT_PLATFORMS)[number];
