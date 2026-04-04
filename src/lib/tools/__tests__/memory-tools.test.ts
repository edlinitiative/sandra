/**
 * Tests for Phase 14 Memory tools:
 *   saveUserNote, listUserNotes, forgetUserNote, updateUserPreferences
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockSaveMemory   = vi.fn().mockResolvedValue(undefined);
const mockGetMemories  = vi.fn();
const mockGetMemory    = vi.fn();
const mockDeleteMemory = vi.fn().mockResolvedValue(undefined);
const mockUserUpdate   = vi.fn();

vi.mock('@/lib/memory/user-memory', () => ({
  getUserMemoryStore: () => ({
    saveMemory:   (...a: unknown[]) => mockSaveMemory(...a),
    getMemories:  (...a: unknown[]) => mockGetMemories(...a),
    getMemory:    (...a: unknown[]) => mockGetMemory(...a),
    deleteMemory: (...a: unknown[]) => mockDeleteMemory(...a),
  }),
  // module-level singleton used by some code paths
  setUserMemoryStore: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      update: (...a: unknown[]) => mockUserUpdate(...a),
    },
  },
}));

// ─── Import tools ─────────────────────────────────────────────────────────────

import '@/lib/tools/save-user-note';
import '@/lib/tools/list-user-notes';
import '@/lib/tools/forget-user-note';
import '@/lib/tools/update-user-preferences';
import { toolRegistry } from '@/lib/tools/registry';
import type { ToolContext } from '@/lib/tools/types';

// ─── Contexts ────────────────────────────────────────────────────────────────

const ctx: ToolContext = {
  sessionId: 'sess-1',
  userId:    'user-1',
  scopes:    ['profile:read'],
};

const anonCtx: ToolContext = { sessionId: 'sess-anon', scopes: [] };

beforeEach(() => vi.clearAllMocks());

// ─── saveUserNote ─────────────────────────────────────────────────────────────

describe('saveUserNote', () => {
  const tool = toolRegistry.get('saveUserNote')!;

  it('is registered with profile:read scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('profile:read');
  });

  it('returns error for anonymous users', async () => {
    const result = await tool.handler({ key: 'lang', value: 'French' }, anonCtx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Authentication');
  });

  it('saves a memory entry and returns confirmation', async () => {
    const result = await tool.handler({ key: 'preferred_language', value: 'French' }, ctx);
    expect(result.success).toBe(true);
    expect(mockSaveMemory).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ key: 'preferred_language', value: 'French', source: 'user_explicit' }),
    );
    const data = result.data as { key: string; value: string; confirmation: string };
    expect(data.key).toBe('preferred_language');
    expect(data.value).toBe('French');
    expect(data.confirmation).toBeTruthy();
  });

  it('rejects empty key', async () => {
    await expect(tool.handler({ key: '', value: 'French' }, ctx)).rejects.toThrow();
  });

  it('rejects empty value', async () => {
    await expect(tool.handler({ key: 'lang', value: '' }, ctx)).rejects.toThrow();
  });
});

// ─── listUserNotes ────────────────────────────────────────────────────────────

describe('listUserNotes', () => {
  const tool = toolRegistry.get('listUserNotes')!;

  it('is registered with profile:read scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('profile:read');
  });

  it('returns error for anonymous users', async () => {
    const result = await tool.handler({}, anonCtx);
    expect(result.success).toBe(false);
  });

  it('returns empty state when no notes exist', async () => {
    mockGetMemories.mockResolvedValueOnce([]);
    const result = await tool.handler({}, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { count: number; notes: unknown[] };
    expect(data.count).toBe(0);
    expect(data.notes).toHaveLength(0);
  });

  it('returns all notes with correct shape', async () => {
    mockGetMemories.mockResolvedValueOnce([
      { key: 'preferred_language', value: 'French',   source: 'user_explicit', confidence: 1.0, updatedAt: new Date() },
      { key: 'city',               value: 'Port-au-Prince', source: 'inferred', confidence: 0.8, updatedAt: new Date() },
    ]);
    const result = await tool.handler({}, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { count: number; notes: Array<{ key: string; source: string }> };
    expect(data.count).toBe(2);
    expect(data.notes[0].key).toBe('preferred_language');
    expect(data.notes[0].source).toBe('user_explicit');
  });

  it('filters to explicit notes only', async () => {
    mockGetMemories.mockResolvedValueOnce([
      { key: 'preferred_language', value: 'French', source: 'user_explicit', confidence: 1.0, updatedAt: new Date() },
      { key: 'city', value: 'PAP', source: 'inferred', confidence: 0.8, updatedAt: new Date() },
    ]);
    const result = await tool.handler({ filter: 'explicit' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { count: number; notes: Array<{ source: string }> };
    expect(data.notes.every((n) => n.source === 'user_explicit')).toBe(true);
  });

  it('filters to inferred notes only', async () => {
    mockGetMemories.mockResolvedValueOnce([
      { key: 'preferred_language', value: 'French', source: 'user_explicit', confidence: 1.0, updatedAt: new Date() },
      { key: 'city', value: 'PAP', source: 'inferred', confidence: 0.8, updatedAt: new Date() },
    ]);
    const result = await tool.handler({ filter: 'inferred' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { notes: Array<{ source: string }> };
    expect(data.notes.every((n) => n.source !== 'user_explicit')).toBe(true);
  });
});

// ─── forgetUserNote ───────────────────────────────────────────────────────────

describe('forgetUserNote', () => {
  const tool = toolRegistry.get('forgetUserNote')!;

  it('is registered with profile:read scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('profile:read');
  });

  it('returns error for anonymous users', async () => {
    const result = await tool.handler({ key: 'city' }, anonCtx);
    expect(result.success).toBe(false);
  });

  it('rejects missing key', async () => {
    await expect(tool.handler({}, ctx)).rejects.toThrow();
  });

  it('returns error when memory key does not exist', async () => {
    mockGetMemory.mockResolvedValueOnce(null);
    const result = await tool.handler({ key: 'nonexistent' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('nonexistent');
  });

  it('deletes the entry and returns confirmation', async () => {
    mockGetMemory.mockResolvedValueOnce({
      key: 'city', value: 'Port-au-Prince', source: 'user_explicit', confidence: 1.0, updatedAt: new Date(),
    });
    const result = await tool.handler({ key: 'city' }, ctx);
    expect(result.success).toBe(true);
    expect(mockDeleteMemory).toHaveBeenCalledWith('user-1', 'city');
    const data = result.data as { key: string; deletedValue: string };
    expect(data.key).toBe('city');
    expect(data.deletedValue).toBe('Port-au-Prince');
  });
});

// ─── updateUserPreferences ────────────────────────────────────────────────────

describe('updateUserPreferences', () => {
  const tool = toolRegistry.get('updateUserPreferences')!;

  it('is registered with profile:read scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('profile:read');
  });

  it('returns error for anonymous users', async () => {
    const result = await tool.handler({ language: 'fr' }, anonCtx);
    expect(result.success).toBe(false);
  });

  it('returns error when no preferences are specified', async () => {
    const result = await tool.handler({}, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('At least one preference');
  });

  it('updates language and saves to memory', async () => {
    mockUserUpdate.mockResolvedValueOnce({ name: 'Test User', language: 'fr', channel: 'web' });
    const result = await tool.handler({ language: 'fr' }, ctx);
    expect(result.success).toBe(true);
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ language: 'fr' }) }),
    );
    expect(mockSaveMemory).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ key: 'preferred_language', value: 'French' }),
    );
    const data = result.data as { updated: { language: string }; confirmation: string };
    expect(data.updated.language).toBe('fr');
    expect(data.confirmation).toContain('language: fr');
  });

  it('updates timezone without DB write (timezone not in DB schema)', async () => {
    const result = await tool.handler({ timezone: 'America/Port-au-Prince' }, ctx);
    expect(result.success).toBe(true);
    // timezone is not in the DB update, only in memory
    expect(mockSaveMemory).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ key: 'timezone', value: 'America/Port-au-Prince' }),
    );
  });

  it('updates multiple preferences at once', async () => {
    mockUserUpdate.mockResolvedValueOnce({ name: 'Pierre', language: 'ht', channel: 'whatsapp' });
    const result = await tool.handler({ language: 'ht', channel: 'whatsapp', name: 'Pierre' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { updated: Record<string, string> };
    expect(data.updated.language).toBe('ht');
    expect(data.updated.channel).toBe('whatsapp');
    expect(data.updated.name).toBe('Pierre');
  });
});
