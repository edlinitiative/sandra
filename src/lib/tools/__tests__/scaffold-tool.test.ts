/**
 * Tests for scaffold-tool.ts
 *
 * Covers:
 *  - auth guard (no userId)
 *  - Zod validation (intent too short)
 *  - dry run (generates code, does NOT persist or register)
 *  - happy path (generates, persists, hot-registers)
 *  - gap context injection (sourceGapIds)
 *  - OpenAI failure → error result
 *  - LLM returns incomplete spec → error result
 *  - refuses to overwrite an existing tool
 *  - succeeds even when hot-registration fails
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCapabilityGapFindMany = vi.fn();
const mockDynamicToolUpsert     = vi.fn();
const mockLogAuditEvent         = vi.fn();
const mockReloadDynamicTool     = vi.fn();
const mockOpenAICreate          = vi.fn();
const mockGetToolNames          = vi.fn().mockReturnValue(['searchKnowledge', 'getProfile']);
const mockRegistryHas           = vi.fn().mockReturnValue(false);
const mockRegistryRegister      = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    capabilityGap: {
      findMany: (...a: unknown[]) => mockCapabilityGapFindMany(...a),
    },
    dynamicTool: {
      upsert: (...a: unknown[]) => mockDynamicToolUpsert(...a),
    },
  },
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: (...a: unknown[]) => mockLogAuditEvent(...a),
}));

vi.mock('@/lib/tools/dynamic-loader', () => ({
  reloadDynamicTool: (...a: unknown[]) => mockReloadDynamicTool(...a),
}));

vi.mock('@/lib/tools/registry', () => ({
  toolRegistry: {
    register:     (...a: unknown[]) => mockRegistryRegister(...a),
    getToolNames: ()                => mockGetToolNames(),
    has:          (...a: unknown[]) => mockRegistryHas(...a),
  },
}));

vi.mock('@/lib/config', () => ({
  env: {
    OPENAI_API_KEY: 'test-key',
    OPENAI_MODEL:   'gpt-4o',
  },
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: (...a: unknown[]) => mockOpenAICreate(...a),
      },
    };
  },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockContext = {
  sessionId: 'test-session',
  userId:    'admin-user-1',
  scopes:    ['admin:tools'],
  channel:   'web'  as const,
  language:  'en'   as const,
};

const goodSpec = {
  name:        'sendSlackNotification',
  description: 'Send a Slack notification to a webhook URL.',
  parameters:  {
    type:       'object',
    properties: {
      webhookUrl: { type: 'string' },
      message:    { type: 'string' },
    },
    required: ['webhookUrl', 'message'],
  },
  requiredScopes: ['actions:submit'],
  handlerCode: `
    const res = await fetch(input.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input.message }),
    });
    return { success: res.ok, data: { status: res.status } };
  `,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('scaffoldTool', () => {
  // Dynamic import so all vi.mock() calls are applied first
  let scaffoldToolDef: Awaited<typeof import('@/lib/tools/scaffold-tool')>['scaffoldToolDef'];

  beforeEach(async () => {
    vi.clearAllMocks();
    // vi.clearAllMocks() clears call history but NOT mockReturnValue/mockImplementation.
    // Explicitly reset to safe defaults so each test starts clean.
    mockRegistryHas.mockReturnValue(false);

    mockDynamicToolUpsert.mockResolvedValue({});
    mockReloadDynamicTool.mockResolvedValue(true);
    mockLogAuditEvent.mockResolvedValue(undefined);
    mockCapabilityGapFindMany.mockResolvedValue([]);
    mockOpenAICreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(goodSpec) } }],
    });

    ({ scaffoldToolDef } = await import('@/lib/tools/scaffold-tool'));
  });

  // ── Auth & validation ────────────────────────────────────────────────────

  it('returns an error when userId is missing', async () => {
    const result = await scaffoldToolDef.handler(
      { intent: 'send a slack notification to a webhook URL' },
      { ...mockContext, userId: undefined },
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/authentication/i);
  });

  it('throws a Zod error when intent is too short', async () => {
    await expect(
      scaffoldToolDef.handler({ intent: 'too short' }, mockContext),
    ).rejects.toThrow();
  });

  // ── Dry run ───────────────────────────────────────────────────────────────

  it('returns generated code on dry run without saving', async () => {
    const result = await scaffoldToolDef.handler(
      { intent: 'send a slack notification to a webhook URL', dryRun: true },
      mockContext,
    );
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.dryRun).toBe(true);
    expect((data.generated as Record<string, unknown>).name).toBe('sendSlackNotification');
    expect(mockDynamicToolUpsert).not.toHaveBeenCalled();
    expect(mockReloadDynamicTool).not.toHaveBeenCalled();
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('generates, persists, and hot-registers a tool', async () => {
    const result = await scaffoldToolDef.handler(
      { intent: 'send a slack notification to a webhook URL' },
      mockContext,
    );

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.toolName).toBe('sendSlackNotification');
    expect(data.registered).toBe(true);
    expect(data.message).toMatch(/live and ready/i);

    expect(mockDynamicToolUpsert).toHaveBeenCalledOnce();
    expect(mockReloadDynamicTool).toHaveBeenCalledWith('sendSlackNotification');
    expect(mockLogAuditEvent).toHaveBeenCalledOnce();
  });

  it('passes sourceGapIds to DB upsert', async () => {
    await scaffoldToolDef.handler(
      {
        intent:       'send a slack notification to a webhook URL',
        sourceGapIds: ['gap-123'],
      },
      mockContext,
    );

    const upsertCall = (mockDynamicToolUpsert.mock.calls[0] as [{ create: { sourceGapIds: string[] } }])[0];
    expect(upsertCall.create.sourceGapIds).toEqual(['gap-123']);
  });

  // ── Gap context ───────────────────────────────────────────────────────────

  it('includes gap user messages in the OpenAI prompt when sourceGapIds provided', async () => {
    mockCapabilityGapFindMany.mockResolvedValue([
      { userMessage: 'please post to our slack', patterns: ['send_message'], channel: 'web' },
    ]);

    await scaffoldToolDef.handler(
      {
        intent:       'send a slack notification to a webhook URL',
        sourceGapIds: ['gap-1'],
      },
      mockContext,
    );

    expect(mockCapabilityGapFindMany).toHaveBeenCalledOnce();

    const createCall = (mockOpenAICreate.mock.calls[0] as [{ messages: Array<{ role: string; content: string }> }])[0];
    const userMsg = createCall.messages.find((m) => m.role === 'user');
    expect(userMsg?.content).toContain('please post to our slack');
  });

  // ── Error paths ───────────────────────────────────────────────────────────

  it('returns error when OpenAI returns invalid JSON', async () => {
    mockOpenAICreate.mockResolvedValue({
      choices: [{ message: { content: 'not-json{{{{' } }],
    });

    const result = await scaffoldToolDef.handler(
      { intent: 'send a slack notification to a webhook URL' },
      mockContext,
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/failed to generate/i);
  });

  it('returns error when LLM output is missing required fields', async () => {
    mockOpenAICreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ name: 'incomplete' }) } }],
    });

    const result = await scaffoldToolDef.handler(
      { intent: 'send a slack notification to a webhook URL' },
      mockContext,
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/incomplete/i);
  });

  it('refuses to overwrite an existing built-in tool', async () => {
    mockRegistryHas.mockReturnValue(true);

    const result = await scaffoldToolDef.handler(
      { intent: 'send a slack notification to a webhook URL' },
      mockContext,
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already exists/i);
    expect(mockDynamicToolUpsert).not.toHaveBeenCalled();
  });

  it('succeeds with a warning when hot-registration fails', async () => {
    mockReloadDynamicTool.mockResolvedValue(false);

    const result = await scaffoldToolDef.handler(
      { intent: 'send a slack notification to a webhook URL' },
      mockContext,
    );
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.registered).toBe(false);
    expect(data.message).toMatch(/saved but could not be hot-registered/i);
    // DB upsert still succeeded
    expect(mockDynamicToolUpsert).toHaveBeenCalledOnce();
  });

  it('returns error when DB upsert throws', async () => {
    mockDynamicToolUpsert.mockRejectedValue(new Error('DB connection lost'));

    const result = await scaffoldToolDef.handler(
      { intent: 'send a slack notification to a webhook URL' },
      mockContext,
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/failed to save/i);
  });
});
