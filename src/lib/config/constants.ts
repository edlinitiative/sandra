/**
 * Application-wide constants.
 */

export const APP_NAME = 'Sandra';
export const APP_DESCRIPTION = 'AI assistant for the EdLight ecosystem';
export const APP_VERSION = '0.1.0';

/** Maximum tokens for a single agent response */
export const MAX_RESPONSE_TOKENS = 2048;

/** Maximum ReAct iterations before agent gives up */
export const MAX_AGENT_ITERATIONS = 5;

/** Maximum messages to include in context window */
export const MAX_CONTEXT_MESSAGES = 20;

/** Alias for MAX_CONTEXT_MESSAGES (phase 1 naming) */
export const CONTEXT_WINDOW_MESSAGES = MAX_CONTEXT_MESSAGES;

/** Alias for DEFAULT_CHUNK_SIZE (phase 1 naming) */
export const CHUNK_SIZE = 1000;

/** Alias for DEFAULT_CHUNK_OVERLAP (phase 1 naming) */
export const CHUNK_OVERLAP = 200;

/** Alias for DEFAULT_TOP_K (phase 1 naming) */
export const TOP_K_RESULTS = 5;

/** Chunk size for document splitting (characters) */
export const DEFAULT_CHUNK_SIZE = 1000;

/** Overlap between chunks (characters) */
export const DEFAULT_CHUNK_OVERLAP = 200;

/** Maximum results from vector search */
export const DEFAULT_TOP_K = 5;

/** Embedding dimension for text-embedding-3-small */
export const EMBEDDING_DIMENSION = 1536;

/** Supported EdLight platforms and programs */
export const EDLIGHT_PLATFORMS = [
  'EdLight Code',
  'EdLight Academy',
  'EdLight News',
  'EdLight Initiative',
  'EdLight Nexus',
  'EdLight Labs',
  'ESLP',
] as const;

export type EdLightPlatform = (typeof EDLIGHT_PLATFORMS)[number];
