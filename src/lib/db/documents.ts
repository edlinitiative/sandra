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
  return prisma.indexedDocument.create({
    data: {
      sourceId: input.sourceId,
      title: input.title,
      path: input.path,
      content: input.content,
      chunkIndex: input.chunkIndex ?? 0,
      chunkTotal: input.chunkTotal ?? 1,
      contentHash: input.contentHash,
      embedding: input.embedding ?? [],
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
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
 */
export async function saveIndexedDocuments(
  prisma: PrismaClient,
  sourceId: string,
  documents: SaveDocumentInput[],
): Promise<void> {
  if (documents.length === 0) return;

  await prisma.indexedDocument.createMany({
    data: documents.map((doc) => ({
      sourceId,
      title: doc.title,
      path: doc.path,
      content: doc.content,
      chunkIndex: doc.chunkIndex ?? 0,
      chunkTotal: doc.chunkTotal ?? 1,
      contentHash: doc.contentHash,
      embedding: doc.embedding ?? [],
      metadata: doc.metadata as Prisma.InputJsonValue | undefined,
    })),
  });

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
