import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hasGroupSharingConsent,
  setGroupSharingConsent,
  getGroupSharingNote,
  storeGroupMessage,
} from '../group-privacy';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetMemory = vi.fn();
const mockSaveMemory = vi.fn();
const mockDeleteMemory = vi.fn();
const mockAddMessage = vi.fn();

vi.mock('@/lib/memory/user-memory', () => ({
  getUserMemoryStore: () => ({
    getMemory: mockGetMemory,
    saveMemory: mockSaveMemory,
    deleteMemory: mockDeleteMemory,
    getMemories: vi.fn().mockResolvedValue([]),
    getMemorySummary: vi.fn().mockResolvedValue(''),
  }),
}));

vi.mock('@/lib/memory/session-store', () => ({
  getPrismaSessionStore: () => ({
    addMessage: mockAddMessage,
    ensureSessionExists: vi.fn(),
    getSession: vi.fn(),
    createSession: vi.fn(),
    updateSession: vi.fn(),
    getMessages: vi.fn().mockResolvedValue([]),
    loadContext: vi.fn().mockResolvedValue([]),
    getContextMessages: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock('@/lib/utils', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Group sharing consent', () => {
  it('returns false when no consent is stored', async () => {
    mockGetMemory.mockResolvedValue(null);
    expect(await hasGroupSharingConsent('user1')).toBe(false);
  });

  it('returns true when consent is granted', async () => {
    mockGetMemory.mockResolvedValue({ key: 'group_sharing_consent', value: 'granted' });
    expect(await hasGroupSharingConsent('user1')).toBe(true);
  });

  it('returns false when consent value is not "granted"', async () => {
    mockGetMemory.mockResolvedValue({ key: 'group_sharing_consent', value: 'revoked' });
    expect(await hasGroupSharingConsent('user1')).toBe(false);
  });

  it('handles errors gracefully', async () => {
    mockGetMemory.mockRejectedValue(new Error('DB error'));
    expect(await hasGroupSharingConsent('user1')).toBe(false);
  });
});

describe('setGroupSharingConsent', () => {
  it('saves consent when granted', async () => {
    mockSaveMemory.mockResolvedValue(undefined);
    await setGroupSharingConsent('user1', true);
    expect(mockSaveMemory).toHaveBeenCalledWith('user1', expect.objectContaining({
      key: 'group_sharing_consent',
      value: 'granted',
      source: 'explicit_consent',
    }));
  });

  it('deletes consent when revoked', async () => {
    mockDeleteMemory.mockResolvedValue(undefined);
    await setGroupSharingConsent('user1', false);
    expect(mockDeleteMemory).toHaveBeenCalledWith('user1', 'group_sharing_consent');
  });
});

describe('getGroupSharingNote', () => {
  it('returns permission note when consent is granted', async () => {
    mockGetMemory.mockResolvedValue({ key: 'group_sharing_consent', value: 'granted' });
    const note = await getGroupSharingNote('user1');
    expect(note).toContain('granted permission');
  });

  it('returns restriction note when no consent', async () => {
    mockGetMemory.mockResolvedValue(null);
    const note = await getGroupSharingNote('user1');
    expect(note).toContain('Do NOT share');
  });
});

describe('storeGroupMessage', () => {
  it('stores a message with sender attribution', async () => {
    mockAddMessage.mockResolvedValue({ id: 'msg1' });

    await storeGroupMessage({
      sessionId: 'whatsapp-group:grp123',
      groupId: 'grp123',
      senderPhone: '50912345678',
      senderName: 'Rony',
      userId: 'user1',
      content: 'Hello everyone!',
    });

    expect(mockAddMessage).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'whatsapp-group:grp123',
      role: 'user',
      content: '[Rony]: Hello everyone!',
      metadata: expect.objectContaining({
        senderPhone: '50912345678',
        senderName: 'Rony',
        isGroupMessage: true,
        groupId: 'grp123',
      }),
    }));
  });

  it('uses redacted phone when no sender name', async () => {
    mockAddMessage.mockResolvedValue({ id: 'msg2' });

    await storeGroupMessage({
      sessionId: 'whatsapp-group:grp123',
      groupId: 'grp123',
      senderPhone: '50912345678',
      senderName: undefined,
      userId: 'user1',
      content: 'Hi!',
    });

    expect(mockAddMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: '[+5091****]: Hi!',
    }));
  });

  it('handles storage errors gracefully', async () => {
    mockAddMessage.mockRejectedValue(new Error('DB error'));

    // Should not throw
    await expect(storeGroupMessage({
      sessionId: 'whatsapp-group:grp123',
      groupId: 'grp123',
      senderPhone: '50912345678',
      senderName: 'Test',
      userId: 'user1',
      content: 'test',
    })).resolves.toBeUndefined();
  });
});
