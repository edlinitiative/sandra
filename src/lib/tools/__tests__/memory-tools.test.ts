/**
 * Tests for Phase 14 User Memory & Preferences tools:
 *   saveUserNote, listUserNotes, forgetUserNote, updateUserPreferences
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockSaveMemory   = vi.fn().mockResolvedValue(undefined);
const mockGetMemories  = vi.fn().mockResolvedValue([]);
const mockGetMemory    = vi.fn().mockResolvedValue(null);
const mockDeleteMemory = vi.fn().mockResolvedValue(undefined);
const mockUserUpdate   = vi.fn();

vi.mock('@/lib/memory/user-memory', () => ({
  getUserMemoryStore: () => ({
    saveMemory:   (...a: unknown[]) => mockSaveMemory(...a),
    getMemories:  (...a: unknown[]) => mockGetMemories(...a),
    getMemory:    (...a: unknown[]) => mockGetMemory(...a),
    deleteMemory: (...a: unknown[]) => mockDeleteMemory(...a),
  }),
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      update:     (...a: unknown[]) => mockUserUpdate(...a),
      findUnique: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── saveUserNote ─────────────────────────────────────────────────────────────

describe('saveUserNote', () => {
  const tool = toolRegistry.get('saveUserNote')!;

  it('is registered with profile:read scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('profile:read');
  });

  it('returns error when no userId', async () => {
    const result = await tool.handler({ key: 'language', value: 'Creole' }, anonCtx);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects missing key or value', async () => {
    await expect(tool.handler({ key: 'language' }, ctx)).rejects.toThrow();
    await expect(tool.handler({ value: 'Creole' }, ctx)).rejects.toThrow();
  });

  it('saves memory and returns confirmation', async () => {
    const result = await tool.handler({ key: 'favorite_sport', value: 'football' }, ctx);
    expect(result.success).toBe(true);
    expect(mockSaveMemory).toHaveBeenCalledWith('user-1', expect.objectContaining({
      key:        'favorite_sport',
      value:      'football',
      source:     'user_explicit',
      confidence: 1.0,
    }));
    const data = result.data as { confirmation: string; key: string; value: string };
    expect(data.key).toBe('favorite_sport');
    expect(data.value).toBe('football');
    expect(data.confirmation).toContain('football');
  });
});

// ─── listUserNotes ────────────────────────────────────────────────────────────

describe('listUserNotes', () => {
  const tool = toolRegistry.get('listUserNotes')!;

  it('is registered with profile:read scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('profile:read');
  });

  it('returns error when no userId', async () => {
    const result = await tool.handler({}, anonCtx);
    expect(result.success).toBe(false);
  });

  it('returns empty message when no memories', async () => {
    mockGetMemories.mockResolvedValueOnce([]);
    const result = await tool.handler({}, ctx);
    expect(result.success).toBe(true);
    expect((result.data as { count: number }).count).toBe(0);
  });

  it('returns all memories', async () => {
    mockGetMemories.mockResolvedValueOnce([
      { key: 'language', value: 'French', source: 'user_explicit', confidence: 1.0, updatedAt: new Date() },
      { key: 'sport',    value: 'football', source: 'conversation', confidence: 0.9, updatedAt: new Date() },
    ]);
    const result = await tool.handler({ filter: 'all' }, ctx);
    expect(result.success).toBe(true);
    expect((result.data as { count: number }).count).toBe(2);
  });

  it('filters to explicit-only memories', async () => {
    mockGetMemories.mockResolvedValueOnce([
      { key: 'language', value: 'French',   source: 'user_explicit', confidence: 1.0, updatedAt: new Date() },
      { key: 'topic',    value: 'AI',        source: 'conversation',  confidence: 0.7, updatedAt: new Date() },
    ]);
    const result = await tool.handler({ filter: 'explicit' }, ctx);
    expect(result.success).toBe(true);
    const notes = (result.data as { notes: Array<{ source: string }> }).notes;
    expect(notes.every((n) => n.source === 'user_explicit')).toBe(true);
    expect(notes).toHaveLength(1);
  });
});

// ─── forgetUserNote ───────────────────────────────────────────────────────────

describe('forgetUserNote', () => {
  const tool = toolRegistry.get('forgetUserNote')!;

  it('is registered with profile:read scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('profile:read');
  });

  it('returns error when no userId', async () => {
    const result = await tool.handler({ key: 'language' }, anonCtx);
    expect(result.success).toBe(false);
  });

  it('returns error when key does not exist', async () => {
    mockGetMemory.mockResolvedValueOnce(null);
    const result = await tool.handler({ key: 'nonexistent' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('nonexistent');
  });

  it('deletes existing memory and returns confirmation', async () => {
    mockGetMemory.mockResolvedValueOnce({
      key: 'language', value: 'French', source: 'user_explicit', confidence: 1.0, updatedAt: new Date(),
    });

    const result = await tool.handler({ key: 'language' }, ctx);
    expect(result.success).toBe(true);
    expect(mockDeleteMemory).toHaveBeenCalledWith('user-1', 'language');
    const data = result.data as { key: string; deletedValue: string };
    expect(data.key).toBe('language');
    expect(data.deletedValue).toBe('French');
  });

  it('rejects missing key', async () => {
    await expect(tool.handler({}, ctx)).rejects.toThrow();
  });
});

// ─── updateUserPreferences ────────────────────────────────────────────────────

describe('updateUserPreferences', () => {
  const tool = toolRegistry.get('updateUserPreferences')!;

  it('is registered with profile:read scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('profile:read');
  });

  it('returns error when no userId', async () => {
    const result = await tool.handler({ language: 'fr' }, anonCtx);
    expect(result.success).toBe(false);
  });

  it('returns error when no preferences provided', async () => {
    const result = await tool.handler({}, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('At least one');
  });

  it('rejects unsupported language', async () => {
    await expect(tool.handler({ language: 'de' }, ctx)).rejects.toThrow();
  });

  it('updates language and persists to DB and memory', async () => {
    mockUserUpdate.mockResolvedValueOnce({ name: 'Alice', language: 'fr', channel: 'web' });

    const result = await tool.handler({ language: 'fr' }, ctx);
    expect(result.success).toBe(true);
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' }, data: { language: 'fr' } }),
    );
    expect(mockSaveMemory).toHaveBeenCalledWith('user-1', expect.objectContaining({
      key:   'preferred_language',
      value: 'French',
    }));
  });

  it('saves timezone to memory without DB update (not a DB field)', async () => {
    const result = await tool.handler({ timezone: 'America/Port-au-Prince' }, ctx);
    expect(result.success).toBe(true);
    // DB should NOT be called because timezone is not in DB schema
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockSaveMemory).toHaveBeenCalledWith('user-1', expect.objectContaining({
      key:   'timezone',
      value: 'America/Port-au-Prince',
    }));
  });

  it('updates name in DB and memory', async () => {
    mockUserUpdate.mockResolvedValueOnce({ name: 'Bob', language: 'en', channel: 'web' });

    const result = await tool.handler({ name: 'Bob' }, ctx);
    expect(result.success).toBe(true);
    expect(mockSaveMemory).toHaveBeenCalledWith('user-1', expect.objectContaining({
      key:   'preferred_name',
      value: 'Bob',
    }));
  });
});
