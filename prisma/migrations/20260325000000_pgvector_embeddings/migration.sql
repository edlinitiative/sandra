-- Enable pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop the FK constraint so IndexedDocument.sourceId can hold repo full names
-- (e.g. "edlinitiative/code") used by the vector store, not just IndexedSource cuids.
-- The relationship is managed by application code; cascade-delete is explicit.
ALTER TABLE "IndexedDocument" DROP CONSTRAINT IF EXISTS "IndexedDocument_sourceId_fkey";

-- Convert embedding column from DOUBLE PRECISION[] to vector(1536)
ALTER TABLE "IndexedDocument" DROP COLUMN IF EXISTS "embedding";
ALTER TABLE "IndexedDocument" ADD COLUMN "embedding" vector(1536);

-- Create HNSW index for fast cosine-distance search
CREATE INDEX IF NOT EXISTS "IndexedDocument_embedding_hnsw_idx"
  ON "IndexedDocument"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
