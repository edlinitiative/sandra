import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { toolRegistry } from '../registry';
import { executeTool } from '../executor';
import { AuthError, ValidationError } from '@/lib/utils';
import type { SandraTool, ToolContext } from '../types';

const baseContext: ToolContext = {
  sessionId: 'sess_1',
  scopes: ['knowledge:read', 'repos:read'],
};

function makeTestTool(overrides?: Partial<SandraTool>): SandraTool {
  return {
    name: 'testTool',
    description: 'Test',
    parameters: { type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'] },
    inputSchema: z.object({ msg: z.string() }),
    requiredScopes: ['knowledge:read'],
    async handler(input: unknown, _ctx: ToolContext) {
      const { msg } = input as { msg: string };
      return { success: true, data: { echo: msg } };
    },
    ...overrides,
  };
}

describe('executeTool', () => {
  beforeEach(() => {
    toolRegistry.clear();
  });

  it('executes a tool successfully', async () => {
    toolRegistry.register(makeTestTool());

    const result = await executeTool('testTool', { msg: 'hello' }, baseContext);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ echo: 'hello' });
  });

  it('returns error result for unknown tool', async () => {
    const result = await executeTool('unknownTool', {}, baseContext);
    expect(result.success).toBe(false);
    expect(result.error).toContain("'unknownTool' not found");
  });

  it('throws AuthError when required scope is missing', async () => {
    toolRegistry.register(makeTestTool({ requiredScopes: ['admin:write'] }));

    const ctxWithoutScope: ToolContext = { sessionId: 'sess_1', scopes: ['knowledge:read'] };

    await expect(executeTool('testTool', { msg: 'hi' }, ctxWithoutScope)).rejects.toThrow(AuthError);
  });

  it('AuthError details include missing scopes', async () => {
    toolRegistry.register(makeTestTool({ requiredScopes: ['admin:write'] }));

    const ctxWithoutScope: ToolContext = { sessionId: 'sess_1', scopes: [] };

    try {
      await executeTool('testTool', { msg: 'hi' }, ctxWithoutScope);
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError);
      expect((e as AuthError).details?.missingScopes).toContain('admin:write');
    }
  });

  it('throws ValidationError for invalid input', async () => {
    toolRegistry.register(makeTestTool());

    // msg is required but missing
    await expect(executeTool('testTool', { wrong: 'field' }, baseContext)).rejects.toThrow(
      ValidationError,
    );
  });

  it('returns ToolResult with success:false when handler throws', async () => {
    toolRegistry.register(
      makeTestTool({
        async handler() {
          throw new Error('handler blew up');
        },
      }),
    );

    const result = await executeTool('testTool', { msg: 'hi' }, baseContext);

    expect(result.success).toBe(false);
    expect(result.error).toBe('handler blew up');
  });

  it('does not re-throw handler errors — wraps in ToolResult', async () => {
    toolRegistry.register(
      makeTestTool({
        async handler() {
          throw new Error('boom');
        },
      }),
    );

    // Should not throw
    await expect(executeTool('testTool', { msg: 'x' }, baseContext)).resolves.toMatchObject({
      success: false,
    });
  });
});
