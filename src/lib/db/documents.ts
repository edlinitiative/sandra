import type { PrismaClient, IndexedDocument, IndexedSource, Prisma } from '@prisma/client';

export type CreateIndexedDocumentInput = {
  sourceId: string;
  title?: string;
  path?: string;
  content: string;
  chunkIndex?: number;
  chunkTotal?: number;
  contentHash?: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
};

export async function createIndexedDocument(
  prisma: PrismaClient,
  input: CreateIndexedDocumentInput,
): Promise<IndexedDocument> {
  const embeddingStr = input.embedding?.length
    ? `[${input.embedding.join(',')}]`
    : null;
  const meta = input.metadata ? JSON.stringify(input.metadata) : null;

  const rows: IndexedDocument[] = await prisma.$queryRawUnsafe(
    `INSERT INTO "IndexedDocument"
       ("id", "sourceId", "title", "path", "content",
        "chunkIndex", "chunkTotal", "contentHash", "embedding", "metadata",
        "createdAt", "updatedAt")
     VALUES (
       gen_random_uuid()::text, $1, $2, $3, $4,
       $5, $6, $7, $8::vector, $9::jsonb,
       NOW(), NOW()
     )
     RETURNING "id", "sourceId", "title", "path", "content",
       "chunkIndex", "chunkTotal", "contentHash", "metadata",
       "createdAt", "updatedAt"`,
    input.sourceId,
    input.title ?? null,
    input.path ?? null,
    input.content,
    input.chunkIndex ?? 0,
    input.chunkTotal ?? 1,
    input.contentHash ?? null,
    embeddingStr,
    meta,
  );
  return rows[0]!;
}

export async function getDocumentsBySourceId(
  prisma: PrismaClient,
  sourceId: string,
): Promise<IndexedDocument[]> {
  return prisma.indexedDocument.findMany({
    where: { sourceId },
    orderBy: [{ path: 'asc' }, { chunkIndex: 'asc' }],
  });
}

export async function getDocumentByHash(
  prisma: PrismaClient,
  sourceId: string,
  contentHash: string,
): Promise<IndexedDocument | null> {
  return prisma.indexedDocument.findFirst({
    where: { sourceId, contentHash },
  });
}

// ── IndexedSource management ──────────────────────────────────────────────────

export type CreateOrUpdateSourceInput = {
  name: string;
  type: string;
  url?: string;
  owner?: string;
  repo?: string;
  branch?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Upsert an IndexedSource record.
 * Keyed on (type, url) unique constraint.
 */
export async function createOrUpdateSource(
  prisma: PrismaClient,
  input: CreateOrUpdateSourceInput,
): Promise<IndexedSource> {
  return prisma.indexedSource.upsert({
    where: {
      type_url: {
        type: input.type,
        url: input.url ?? '',
      },
    },
    create: {
      name: input.name,
      type: input.type,
      url: input.url,
      owner: input.owner,
      repo: input.repo,
      branch: input.branch ?? 'main',
      status: 'indexing',
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
    update: {
      name: input.name,
      owner: input.owner,
      repo: input.repo,
      branch: input.branch ?? 'main',
      status: 'indexing',
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
      updatedAt: new Date(),
    },
  });
}

export type SaveDocumentInput = {
  title?: string;
  path?: string;
  content: string;
  chunkIndex?: number;
  chunkTotal?: number;
  contentHash?: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
};

/**
 * Bulk create IndexedDocument records for a source.
 * Uses raw SQL to handle the pgvector embedding column.
 */
export async function saveIndexedDocuments(
  prisma: PrismaClient,
  sourceId: string,
  documents: SaveDocumentInput[],
): Promise<void> {
  if (documents.length === 0) return;

  // Insert in batches using raw SQL (Prisma can't handle vector type via createMany)
  for (const doc of documents) {
    const embeddingStr = doc.embedding?.length
      ? `[${doc.embedding.join(',')}]`
      : null;
    const meta = doc.metadata ? JSON.stringify(doc.metadata) : null;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "IndexedDocument"
         ("id", "sourceId", "title", "path", "content",
          "chunkIndex", "chunkTotal", "contentHash", "embedding", "metadata",
          "createdAt", "updatedAt")
       VALUES (
         gen_random_uuid()::text, $1, $2, $3, $4,
         $5, $6, $7, $8::vector, $9::jsonb,
         NOW(), NOW()
       )`,
      sourceId,
      doc.title ?? null,
      doc.path ?? null,
      doc.content,
      doc.chunkIndex ?? 0,
      doc.chunkTotal ?? 1,
      doc.contentHash ?? null,
      embeddingStr,
      meta,
    );
  }

  // Update the source's documentCount
  await prisma.indexedSource.update({
    where: { id: sourceId },
    data: {
      documentCount: documents.length,
      lastIndexedAt: new Date(),
      status: 'indexed',
    },
  });
}

/**
 * Remove all IndexedDocument records for a source (for re-indexing).
 */
export async function deleteDocumentsForSource(
  prisma: PrismaClient,
  sourceId: string,
): Promise<void> {
  await prisma.indexedDocument.deleteMany({ where: { sourceId } });
}
