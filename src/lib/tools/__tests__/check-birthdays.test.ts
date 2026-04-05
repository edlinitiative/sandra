/**
 * Tests for checkBirthdays tool + pure helper functions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockResolveGoogleContext = vi.fn();
const mockResolveTenantForUser = vi.fn();
const mockListDirectoryPeopleWithBirthdays = vi.fn();
const mockFindSheetsWithBirthdayData = vi.fn();
const mockReadSheetRows = vi.fn();
const mockParseBirthdayToMMDD = vi.fn();
const mockLogAuditEvent = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/google/context', () => ({
  resolveGoogleContext: (...a: unknown[]) => mockResolveGoogleContext(...a),
  resolveTenantForUser: (...a: unknown[]) => mockResolveTenantForUser(...a),
}));

vi.mock('@/lib/google/directory', () => ({
  listDirectoryPeopleWithBirthdays: (...a: unknown[]) => mockListDirectoryPeopleWithBirthdays(...a),
}));

vi.mock('@/lib/google/drive', () => ({
  findSheetsWithBirthdayData: (...a: unknown[]) => mockFindSheetsWithBirthdayData(...a),
  readSheetRows: (...a: unknown[]) => mockReadSheetRows(...a),
  parseBirthdayToMMDD: (...a: unknown[]) => mockParseBirthdayToMMDD(...a),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: (...a: unknown[]) => mockLogAuditEvent(...a),
}));

vi.mock('@/lib/config', () => ({
  env: {
    WHATSAPP_PHONE_NUMBER_ID: 'test-phone-id',
    WHATSAPP_ACCESS_TOKEN: 'test-token',
    WHATSAPP_API_VERSION: 'v18.0',
    BIRTHDAY_ADMIN_PHONE: '50912345678',
    BIRTHDAY_CONTACTS_SHEET_ID: undefined,
  },
}));

// Mock global fetch for WhatsApp send
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ─── Import tool + helpers ────────────────────────────────────────────────────

import '@/lib/tools/check-birthdays';
import { toolRegistry } from '@/lib/tools/registry';
import type { ToolContext } from '@/lib/tools/types';
import {
  draftBirthdayMessage,
  contactTypeLabel,
} from '@/lib/tools/check-birthdays';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ctx: ToolContext = { sessionId: 'sess-1', userId: 'user-1', scopes: ['contacts:read', 'whatsapp:send'] };
const anonCtx: ToolContext = { sessionId: 'sess-anon', scopes: [] };

const googleCtx = {
  impersonateEmail: 'admin@edlight.org',
  config: { driveImpersonateEmail: undefined },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveTenantForUser.mockResolvedValue('tenant-1');
  mockResolveGoogleContext.mockResolvedValue(googleCtx);
  mockListDirectoryPeopleWithBirthdays.mockResolvedValue([]);
  mockFindSheetsWithBirthdayData.mockResolvedValue([]);
  mockReadSheetRows.mockResolvedValue([]);
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ messages: [{ id: 'wamid-123' }] }),
    text: async () => '{}',
  });
});

// ─── Pure helper tests ────────────────────────────────────────────────────────

describe('contactTypeLabel', () => {
  it('returns correct labels', () => {
    expect(contactTypeLabel('general')).toContain('General');
    expect(contactTypeLabel('eslp_rejected')).toContain('not selected');
    expect(contactTypeLabel('current_member')).toContain('Member');
    expect(contactTypeLabel('eslp_alumni')).toContain('Alum');
  });
});

describe('draftBirthdayMessage', () => {
  it('generates personalised message per type', () => {
    const gen = draftBirthdayMessage('Jean Pierre', 'general');
    expect(gen).toContain('Jean');
    expect(gen).toContain('Happy Birthday');

    const alumni = draftBirthdayMessage('Marie', 'eslp_alumni');
    expect(alumni).toContain('Marie');
    expect(alumni).toContain('Alum');

    const member = draftBirthdayMessage('Rony', 'current_member');
    expect(member).toContain('Rony');
    expect(member).toContain('active member');

    const rejected = draftBirthdayMessage('Ted', 'eslp_rejected');
    expect(rejected).toContain('Ted');
    expect(rejected).toContain('EdLight');
  });
});

// ─── Tool handler tests ───────────────────────────────────────────────────────

describe('checkBirthdays', () => {
  const tool = toolRegistry.get('checkBirthdays')!;

  it('is registered with required scopes', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('contacts:read');
    expect(tool.requiredScopes).toContain('whatsapp:send');
  });

  it('rejects anonymous users', async () => {
    const result = await tool.handler({}, anonCtx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Authentication');
  });

  it('returns error when no tenant linked', async () => {
    mockResolveTenantForUser.mockResolvedValue(null);
    const result = await tool.handler({}, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not linked');
  });

  it('reports zero birthdays when none found', async () => {
    const result = await tool.handler({ dryRun: true }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.count).toBe(0);
    expect((data.message as string)).toContain('No birthdays');
  });

  it('finds birthdays from Google Contacts source', async () => {
    mockListDirectoryPeopleWithBirthdays.mockResolvedValue([
      { name: 'Jean', email: 'jean@test.com', phone: '50912345', birthday: '04-04' },
    ]);

    const result = await tool.handler({ dryRun: true }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.count).toBe(1);
    const birthdays = data.birthdays as Array<{ name: string }>;
    expect(birthdays[0]!.name).toBe('Jean');
  });

  it('finds birthdays from Drive sheets source', async () => {
    mockFindSheetsWithBirthdayData.mockResolvedValue([
      { name: 'Marie', email: 'marie@test.com', phone: '', birthday: '04-04', sheetName: 'Alumni Survey' },
    ]);

    const result = await tool.handler({ dryRun: true, sources: ['forms'] }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.count).toBe(1);
    const birthdays = data.birthdays as Array<{ contactType: string }>;
    expect(birthdays[0]!.contactType).toBe('eslp_alumni'); // inferred from "Alumni" in sheet name
  });

  it('deduplicates contacts across sources by email', async () => {
    mockListDirectoryPeopleWithBirthdays.mockResolvedValue([
      { name: 'Jean', email: 'jean@test.com', phone: '509123', birthday: '04-04' },
    ]);
    mockFindSheetsWithBirthdayData.mockResolvedValue([
      { name: 'Jean Pierre', email: 'jean@test.com', phone: '', birthday: '04-04', sheetName: 'ESLP 2024' },
    ]);

    const result = await tool.handler({ dryRun: true }, ctx);
    const data = result.data as Record<string, unknown>;
    expect(data.count).toBe(1); // deduplicated
  });

  it('sends WhatsApp alert when not dry run', async () => {
    mockListDirectoryPeopleWithBirthdays.mockResolvedValue([
      { name: 'Jean', email: 'jean@test.com', phone: '509123', birthday: '04-04' },
    ]);

    const result = await tool.handler({ adminPhone: '50912345678' }, ctx);
    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const data = result.data as Record<string, unknown>;
    expect((data.message as string)).toContain('WhatsApp alert sent');
  });

  it('reports WhatsApp failure without crashing', async () => {
    mockListDirectoryPeopleWithBirthdays.mockResolvedValue([
      { name: 'Jean', email: 'jean@test.com', phone: '509123', birthday: '04-04' },
    ]);
    mockFetch.mockResolvedValue({ ok: false, text: async () => 'Bad token', json: async () => ({}) });

    const result = await tool.handler({ adminPhone: '50912345678' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.whatsappError).toBeTruthy();
    expect((data.message as string)).toContain('failed');
  });

  it('logs audit event', async () => {
    await tool.handler({ dryRun: true }, ctx);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      resource: 'checkBirthdays',
      success: true,
    }));
  });
});
