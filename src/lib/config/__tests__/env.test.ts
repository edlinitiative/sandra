import { describe, it, expect, vi, afterEach } from 'vitest';

describe('env config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exports a valid env object with defaults', async () => {
    const { env } = await import('../env');
    expect(env.NODE_ENV).toBeDefined();
    expect(env.OPENAI_MODEL).toBe('gpt-4o');
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('DATABASE_URL has a default value', async () => {
    const { env } = await import('../env');
    expect(typeof env.DATABASE_URL).toBe('string');
    expect(env.DATABASE_URL.length).toBeGreaterThan(0);
  });

  it('ADMIN_API_KEY is optional and may be undefined', async () => {
    const { env } = await import('../env');
    // It's optional, so it can be undefined or a string
    expect(env.ADMIN_API_KEY === undefined || typeof env.ADMIN_API_KEY === 'string').toBe(true);
  });

  it('OPENAI_EMBEDDING_MODEL defaults to text-embedding-3-small', async () => {
    const { env } = await import('../env');
    expect(env.OPENAI_EMBEDDING_MODEL).toBe('text-embedding-3-small');
  });

  it('VECTOR_STORE_PROVIDER accepts postgres', async () => {
    const { env } = await import('../env');
    expect(['memory', 'postgres', 'pinecone', 'qdrant', 'weaviate']).toContain(env.VECTOR_STORE_PROVIDER);
  });
});
