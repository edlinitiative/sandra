import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { ToolRegistry, toolRegistry, getToolRegistry } from '../registry';
import type { SandraTool, ToolContext } from '../types';

function makeTool(name: string): SandraTool {
  return {
    name,
    description: `Test tool ${name}`,
    parameters: { type: 'object', properties: {}, required: [] },
    inputSchema: z.object({}),
    requiredScopes: ['test:read'],
    async handler(_input: unknown, _ctx: ToolContext) {
      return { success: true, data: { name } };
    },
  };
}

describe('ToolRegistry', () => {
  beforeEach(() => {
    toolRegistry.clear();
  });

  it('registers a tool and retrieves it by name', () => {
    toolRegistry.register(makeTool('myTool'));
    const tool = toolRegistry.get('myTool');
    expect(tool).toBeDefined();
    expect(tool?.name).toBe('myTool');
  });

  it('has() returns true after registration', () => {
    toolRegistry.register(makeTool('myTool'));
    expect(toolRegistry.has('myTool')).toBe(true);
  });

  it('has() returns false for unregistered tool', () => {
    expect(toolRegistry.has('nonexistent')).toBe(false);
  });

  it('throws on duplicate registration', () => {
    toolRegistry.register(makeTool('duplicate'));
    expect(() => toolRegistry.register(makeTool('duplicate'))).toThrow(
      "Tool 'duplicate' is already registered",
    );
  });

  it('getAll() returns all registered tools', () => {
    toolRegistry.register(makeTool('a'));
    toolRegistry.register(makeTool('b'));
    const all = toolRegistry.getAll();
    expect(all).toHaveLength(2);
    expect(all.map((t) => t.name)).toContain('a');
    expect(all.map((t) => t.name)).toContain('b');
  });

  it('getToolDefinitions() returns OpenAI function-calling format', () => {
    toolRegistry.register(makeTool('myTool'));
    const defs = toolRegistry.getToolDefinitions();
    expect(defs).toHaveLength(1);
    expect(defs[0]).toMatchObject({
      name: 'myTool',
      description: 'Test tool myTool',
      parameters: { type: 'object' },
    });
  });

  it('listTools() includes requiredScopes', () => {
    toolRegistry.register(makeTool('myTool'));
    const info = toolRegistry.listTools();
    expect(info[0]?.requiredScopes).toEqual(['test:read']);
  });

  it('getToolNames() returns all names', () => {
    toolRegistry.register(makeTool('a'));
    toolRegistry.register(makeTool('b'));
    expect(toolRegistry.getToolNames()).toContain('a');
    expect(toolRegistry.getToolNames()).toContain('b');
  });

  it('clear() empties the registry', () => {
    toolRegistry.register(makeTool('a'));
    toolRegistry.clear();
    expect(toolRegistry.getAll()).toHaveLength(0);
  });

  it('getToolRegistry() returns the singleton', () => {
    expect(getToolRegistry()).toBe(toolRegistry);
  });

  it('ToolRegistry class can be instantiated independently', () => {
    const fresh = new ToolRegistry();
    fresh.register(makeTool('isolated'));
    expect(fresh.has('isolated')).toBe(true);
    expect(toolRegistry.has('isolated')).toBe(false);
  });
});
