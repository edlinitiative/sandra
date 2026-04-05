/**
 * Tests for createGoogleForm and getFormResponses tools.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockResolveGoogleContext = vi.fn();
const mockResolveTenantForUser = vi.fn();
const mockDbUserFindUnique = vi.fn();
const mockCreateForm = vi.fn();
const mockGetFormResponses = vi.fn();
const mockLogAuditEvent = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/google/context', () => ({
  resolveGoogleContext: (...a: unknown[]) => mockResolveGoogleContext(...a),
  resolveTenantForUser: (...a: unknown[]) => mockResolveTenantForUser(...a),
  resolveTenantForContext: (...a: unknown[]) => mockResolveTenantForUser(...a),
}));

vi.mock('@/lib/db', () => ({
  db: { user: { findUnique: (...a: unknown[]) => mockDbUserFindUnique(...a) } },
}));

vi.mock('@/lib/google/forms', () => ({
  createForm: (...a: unknown[]) => mockCreateForm(...a),
  getFormResponses: (...a: unknown[]) => mockGetFormResponses(...a),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: (...a: unknown[]) => mockLogAuditEvent(...a),
}));

// ─── Import tools ─────────────────────────────────────────────────────────────

import '@/lib/tools/create-google-form';
import '@/lib/tools/get-form-responses';
import { toolRegistry } from '@/lib/tools/registry';
import type { ToolContext } from '@/lib/tools/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ctx: ToolContext = { sessionId: 'sess-1', userId: 'user-1', scopes: ['forms:write', 'forms:read'] };
const anonCtx: ToolContext = { sessionId: 'sess-anon', scopes: [] };

const googleCtx = { impersonateEmail: 'rony@edlight.org', config: {} };

const sampleQuestion = { title: 'Full name', type: 'short_answer', required: true };

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveTenantForUser.mockResolvedValue('tenant-1');
  mockResolveGoogleContext.mockResolvedValue(googleCtx);
  mockDbUserFindUnique.mockResolvedValue({ email: 'rony@edlight.org' });
});

// ─── createGoogleForm ─────────────────────────────────────────────────────────

describe('createGoogleForm', () => {
  const tool = toolRegistry.get('createGoogleForm')!;

  it('is registered with forms:write scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('forms:write');
  });

  it('rejects anonymous users', async () => {
    const result = await tool.handler({ title: 'Test Form', questions: [sampleQuestion] }, anonCtx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('signed in');
  });

  it('returns error when no tenant linked', async () => {
    mockResolveTenantForUser.mockResolvedValue(null);
    const result = await tool.handler({ title: 'Test Form', questions: [sampleQuestion] }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Workspace');
  });

  it('returns error when no user email found', async () => {
    mockDbUserFindUnique.mockResolvedValue({ email: null });
    const result = await tool.handler({ title: 'Test Form', questions: [sampleQuestion] }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('email address');
  });

  it('creates a form and returns links', async () => {
    mockCreateForm.mockResolvedValue({
      formId: 'form-abc123',
      title: 'ESLP 2026 Application Form',
      responderUri: 'https://docs.google.com/forms/d/form-abc123/viewform',
      editUrl: 'https://docs.google.com/forms/d/form-abc123/edit',
      questionCount: 3,
    });

    const result = await tool.handler({
      title: 'ESLP 2026 Application Form',
      questions: [
        { title: 'Full name', type: 'short_answer', required: true },
        { title: 'Email', type: 'short_answer', required: true },
        { title: 'Why are you applying?', type: 'paragraph', required: false },
      ],
    }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.formId).toBe('form-abc123');
    expect(data.questionCount).toBe(3);
    expect(data.responderUri).toContain('viewform');
    expect(data.editUrl).toContain('/edit');
    expect((data.message as string)).toContain('3 question');
  });

  it('uses ownerEmail override when provided', async () => {
    mockCreateForm.mockResolvedValue({
      formId: 'form-xyz',
      title: 'Survey',
      responderUri: 'https://docs.google.com/forms/d/form-xyz/viewform',
      editUrl: 'https://docs.google.com/forms/d/form-xyz/edit',
      questionCount: 1,
    });

    await tool.handler({
      title: 'Survey',
      questions: [sampleQuestion],
      ownerEmail: 'ted@edlight.org',
    }, ctx);

    expect(mockResolveGoogleContext).toHaveBeenCalledWith('tenant-1', 'ted@edlight.org');
  });

  it('returns DWD error on 403', async () => {
    mockCreateForm.mockRejectedValue(new Error('Request failed with status 403'));
    const result = await tool.handler({ title: 'Test Form', questions: [sampleQuestion] }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Forms API');
  });

  it('logs audit event on success', async () => {
    mockCreateForm.mockResolvedValue({
      formId: 'form-audit',
      title: 'Audit Form',
      responderUri: 'https://docs.google.com/forms/d/form-audit/viewform',
      editUrl: 'https://docs.google.com/forms/d/form-audit/edit',
      questionCount: 1,
    });

    await tool.handler({ title: 'Audit Form', questions: [sampleQuestion] }, ctx);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1', resource: 'createGoogleForm', success: true,
    }));
  });
});

// ─── getFormResponses ─────────────────────────────────────────────────────────

describe('getFormResponses', () => {
  const tool = toolRegistry.get('getFormResponses')!;

  const sampleResponses = {
    formTitle: 'ESLP 2026 Application Form',
    totalResponses: 2,
    responses: [
      {
        responseId: 'resp-1',
        respondentEmail: 'alice@example.com',
        submittedAt: '2026-03-01T10:00:00Z',
        answers: { 'Full name': 'Alice Dupont', 'Why applying?': 'To learn English.' },
      },
      {
        responseId: 'resp-2',
        respondentEmail: 'bob@example.com',
        submittedAt: '2026-03-02T11:00:00Z',
        answers: { 'Full name': 'Bob Martin', 'Why applying?': 'Career growth.' },
      },
    ],
  };

  it('is registered with forms:read scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('forms:read');
  });

  it('rejects anonymous users', async () => {
    const result = await tool.handler({ formId: 'form-1' }, anonCtx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('signed in');
  });

  it('returns error when no tenant linked', async () => {
    mockResolveTenantForUser.mockResolvedValue(null);
    const result = await tool.handler({ formId: 'form-1' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Workspace');
  });

  it('returns error when no user email found', async () => {
    mockDbUserFindUnique.mockResolvedValue({ email: null });
    const result = await tool.handler({ formId: 'form-1' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('email address');
  });

  it('returns full response data', async () => {
    mockGetFormResponses.mockResolvedValue(sampleResponses);

    const result = await tool.handler({ formId: 'form-eslp-2026' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.totalResponses).toBe(2);
    expect(data.formTitle).toBe('ESLP 2026 Application Form');
    expect((data.responses as unknown[]).length).toBe(2);
    expect((data.message as string)).toContain('2 response');
  });

  it('returns summary-only when summaryOnly=true', async () => {
    mockGetFormResponses.mockResolvedValue(sampleResponses);

    const result = await tool.handler({ formId: 'form-eslp-2026', summaryOnly: true }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.totalResponses).toBe(2);
    expect(data).not.toHaveProperty('responses');
    expect((data.message as string)).toContain('alice@example.com');
  });

  it('returns DWD error on 403', async () => {
    mockGetFormResponses.mockRejectedValue(new Error('Request failed with status 403'));
    const result = await tool.handler({ formId: 'form-1' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('forms.responses.readonly');
  });

  it('logs audit event', async () => {
    mockGetFormResponses.mockResolvedValue({ ...sampleResponses, totalResponses: 0, responses: [] });
    await tool.handler({ formId: 'form-1' }, ctx);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1', resource: 'getFormResponses', success: true,
    }));
  });
});
