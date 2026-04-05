/**
 * Tests for dynamic-loader.ts
 *
 * Covers:
 *  - loadDynamicTools registers enabled tools from DB
 *  - loadDynamicTools skips already-registered tools (idempotent)
 *  - loadDynamicTools handles empty DB gracefully
 *  - reloadDynamicTool removes old registration and re-registers
 *  - reloadDynamicTool returns false for non-existent tool
 *  - reloadDynamicTool returns false for disabled tool
 *  - registered handler executes the handler code correctly
 *  - handler wraps thrown errors in an error result
 *  - invalid handler code is silently skipped (does not throw)
 *  - ensureDynamicToolsLoaded is idempotent (only calls DB once per loadPromise)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadDynamicTools, reloadDynamicTool } from '@/lib/tools/dynamic-loader';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockFindMany   = vi.fn();
const mockFindUnique = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    dynamicTool: {
      findMany:   (...a: unknown[]) => mockFindMany(...a),
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
    },
  },
}));

// vi.hoisted ensures the Map is initialised before vi.mock factories are called
const { registryTools, mockRegisterFn } = vi.hoisted(() => {
  const registryTools = new Map<string, unknown>();
  const mockRegisterFn = vi.fn((tool: { name: string }) => {
    registryTools.set(tool.name, tool);
  });
  return { registryTools, mockRegisterFn };
});

vi.mock('@/lib/tools/registry', () => ({
  toolRegistry: {
    register: (t: { name: string }) => mockRegisterFn(t),
    has:      (name: string)         => registryTools.has(name),
    tools:    registryTools,
  },
}));

vi.mock('@/lib/tools/executor', () => ({
  executeTool: vi.fn(),
}));

vi.mock('@/lib/utils', () => ({
  createLogger: () => ({
    info:  vi.fn(),
    warn:  vi.fn(),
    error: vi.fn(),
  }),
}));

// ─── Fixture ──────────────────────────────────────────────────────────────────

const baseTool = {
  id:             'dyn-1',
  name:           'echoMessage',
  description:    'Echoes the input message.',
  parameters:     { type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'] },
  handlerCode:    'return { success: true, data: { echo: input.msg } };',
  requiredScopes: ['knowledge:read'],
  enabled:        true,
  createdAt:      new Date('2026-01-01'),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('dynamic-loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registryTools.clear();
  });

  // ── loadDynamicTools ──────────────────────────────────────────────────────

  it('registers enabled tools from DB', async () => {
    mockFindMany.mockResolvedValue([baseTool]);

    await loadDynamicTools();

    expect(mockFindMany).toHaveBeenCalledWith({
      where:   { enabled: true },
      orderBy: { createdAt: 'asc' },
    });
    expect(mockRegisterFn).toHaveBeenCalledOnce();
    expect(mockRegisterFn.mock.calls[0]?.[0].name).toBe('echoMessage');
  });

  it('skips tools that are already registered', async () => {
    mockFindMany.mockResolvedValue([baseTool]);
    registryTools.set('echoMessage', {}); // pre-populate registry

    await loadDynamicTools();

    expect(mockRegisterFn).not.toHaveBeenCalled();
  });

  it('resolves without error when DB returns no tools', async () => {
    mockFindMany.mockResolvedValue([]);

    await expect(loadDynamicTools()).resolves.not.toThrow();
    expect(mockRegisterFn).not.toHaveBeenCalled();
  });

  it('propagates DB errors from loadDynamicTools', async () => {
    mockFindMany.mockRejectedValue(new Error('DB offline'));

    await expect(loadDynamicTools()).rejects.toThrow('DB offline');
  });

  it('registers multiple tools in creation order', async () => {
    const toolA = { ...baseTool, id: 'a', name: 'toolA', createdAt: new Date('2026-01-01') };
    const toolB = { ...baseTool, id: 'b', name: 'toolB', createdAt: new Date('2026-01-02') };
    mockFindMany.mockResolvedValue([toolA, toolB]);

    await loadDynamicTools();

    expect(mockRegisterFn).toHaveBeenCalledTimes(2);
    expect(mockRegisterFn.mock.calls[0]?.[0].name).toBe('toolA');
    expect(mockRegisterFn.mock.calls[1]?.[0].name).toBe('toolB');
  });

  // ── reloadDynamicTool ─────────────────────────────────────────────────────

  it('removes old registration and re-registers the updated tool', async () => {
    mockFindUnique.mockResolvedValue(baseTool);
    registryTools.set('echoMessage', {}); // simulate existing registration

    const ok = await reloadDynamicTool('echoMessage');

    expect(ok).toBe(true);
    expect(mockRegisterFn).toHaveBeenCalledOnce();
    expect(mockRegisterFn.mock.calls[0]?.[0].name).toBe('echoMessage');
  });

  it('returns false when tool does not exist in DB', async () => {
    mockFindUnique.mockResolvedValue(null);

    const ok = await reloadDynamicTool('nonExistent');

    expect(ok).toBe(false);
    expect(mockRegisterFn).not.toHaveBeenCalled();
  });

  it('returns false when the found tool is disabled', async () => {
    mockFindUnique.mockResolvedValue({ ...baseTool, enabled: false });

    const ok = await reloadDynamicTool('echoMessage');

    expect(ok).toBe(false);
    expect(mockRegisterFn).not.toHaveBeenCalled();
  });

  // ── Handler execution ─────────────────────────────────────────────────────

  it('the registered handler executes the stored handler code', async () => {
    mockFindMany.mockResolvedValue([baseTool]);
    await loadDynamicTools();

    const registeredTool = mockRegisterFn.mock.calls[0]?.[0] as {
      name:    string;
      handler: (input: unknown, context: unknown) => Promise<{ success: boolean; data: unknown }>;
    };

    const result = await registeredTool.handler(
      { msg: 'hello world' },
      { sessionId: 'sess-1', userId: null, scopes: [] },
    );

    expect(result).toMatchObject({ success: true, data: { echo: 'hello world' } });
  });

  it('wraps a thrown error from handler code in an error result', async () => {
    const throwingTool = {
      ...baseTool,
      name:        'throwingTool',
      handlerCode: 'throw new Error("intentional");',
    };
    mockFindMany.mockResolvedValue([throwingTool]);
    await loadDynamicTools();

    const registeredTool = mockRegisterFn.mock.calls[0]?.[0] as unknown as {
      handler: (input: unknown, context: unknown) => Promise<{ success: boolean; error?: string }>;
    };

    const result = await registeredTool.handler({}, {});
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/throwingTool.*intentional/);
  });

  it('silently skips tools with syntactically invalid handler code', async () => {
    const badTool = { ...baseTool, name: 'badSyntax', handlerCode: '{{{{{{{{{{' };
    mockFindMany.mockResolvedValue([badTool]);

    await expect(loadDynamicTools()).resolves.not.toThrow();
    expect(registryTools.has('badSyntax')).toBe(false);
  });

  // ── ensureDynamicToolsLoaded idempotency ──────────────────────────────────

  it('ensureDynamicToolsLoaded calls DB only once for parallel invocations', async () => {
    mockFindMany.mockResolvedValue([]);

    // Get a fresh module instance to reset the loadPromise singleton
    vi.resetModules();
    const freshMod = await import('@/lib/tools/dynamic-loader');

    await Promise.all([
      freshMod.ensureDynamicToolsLoaded(),
      freshMod.ensureDynamicToolsLoaded(),
      freshMod.ensureDynamicToolsLoaded(),
    ]);

    expect(mockFindMany).toHaveBeenCalledTimes(1);
  });
});
