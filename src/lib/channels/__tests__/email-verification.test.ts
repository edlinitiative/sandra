import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateVerificationCode,
  maskEmail,
  extractVerificationCode,
  startEmailVerification,
  verifyCode,
  hasPendingVerification,
} from '../email-verification';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetMemory = vi.fn();
const mockSaveMemory = vi.fn();
const mockDeleteMemory = vi.fn();

vi.mock('@/lib/memory/user-memory', () => ({
  getUserMemoryStore: () => ({
    getMemory: mockGetMemory,
    saveMemory: mockSaveMemory,
    deleteMemory: mockDeleteMemory,
    getMemories: vi.fn().mockResolvedValue([]),
    getMemorySummary: vi.fn().mockResolvedValue(''),
  }),
}));

const mockGetUserByEmail = vi.fn();
vi.mock('@/lib/google/directory', () => ({
  getUserByEmail: (...args: unknown[]) => mockGetUserByEmail(...args),
}));

const mockSendEmail = vi.fn();
vi.mock('@/lib/google/gmail', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

vi.mock('@/lib/google/context', () => ({
  resolveGoogleContext: vi.fn().mockResolvedValue({ tenantId: 'test-tenant', config: {} }),
}));

vi.mock('@/lib/channels/identity-linker', () => ({
  linkWorkspaceIdentity: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: { user: { update: vi.fn().mockResolvedValue({}) } },
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

// ── Pure functions ────────────────────────────────────────────────────────────

describe('generateVerificationCode', () => {
  it('generates a 6-digit string', () => {
    const code = generateVerificationCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('generates different codes', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateVerificationCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('maskEmail', () => {
  it('masks a normal email', () => {
    expect(maskEmail('rony@edlight.org')).toBe('r***@edlight.org');
  });

  it('handles single-char local part', () => {
    expect(maskEmail('r@edlight.org')).toBe('r***@edlight.org');
  });

  it('handles missing @', () => {
    expect(maskEmail('notanemail')).toBe('***@***');
  });
});

describe('extractVerificationCode', () => {
  it('extracts a bare 6-digit code', () => {
    expect(extractVerificationCode('123456')).toBe('123456');
  });

  it('extracts from "the code is 123456"', () => {
    expect(extractVerificationCode('the code is 123456')).toBe('123456');
  });

  it('extracts from "code: 123 456"', () => {
    expect(extractVerificationCode('code: 123 456')).toBe('123456');
  });

  it('extracts code embedded in text', () => {
    expect(extractVerificationCode('Hey Sandra, my code is 789012 thanks')).toBe('789012');
  });

  it('returns null for non-code text', () => {
    expect(extractVerificationCode('hello how are you?')).toBeNull();
  });

  it('returns null for 5-digit numbers', () => {
    expect(extractVerificationCode('12345')).toBeNull();
  });
});

// ── startEmailVerification ──────────────────────────────────────────────────

describe('startEmailVerification', () => {
  it('fails if email not in directory', async () => {
    mockGetUserByEmail.mockResolvedValue(null);

    const result = await startEmailVerification('user-1', 'nobody@edlight.org');
    expect(result.success).toBe(false);
    expect(result.error).toContain('couldn\'t find');
  });

  it('sends verification email and stores pending code', async () => {
    mockGetUserByEmail.mockResolvedValue({
      id: 'u1',
      email: 'rony@edlight.org',
      name: 'Rony Francillon',
      givenName: 'Rony',
      isAdmin: false,
      suspended: false,
    });
    mockSendEmail.mockResolvedValue({ messageId: 'msg-1', threadId: 't-1', labelIds: [] });

    const result = await startEmailVerification('user-1', 'rony@edlight.org');

    expect(result.success).toBe(true);
    expect(result.maskedEmail).toBe('r***@edlight.org');
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    // Should store 4 memory keys: code, email, expires, attempts
    expect(mockSaveMemory).toHaveBeenCalledTimes(4);
  });

  it('fails gracefully if email send fails', async () => {
    mockGetUserByEmail.mockResolvedValue({
      id: 'u1',
      email: 'rony@edlight.org',
      name: 'Rony',
      isAdmin: false,
      suspended: false,
    });
    mockSendEmail.mockRejectedValue(new Error('Gmail API error'));

    const result = await startEmailVerification('user-1', 'rony@edlight.org');
    expect(result.success).toBe(false);
    expect(result.error).toContain('couldn\'t send');
  });
});

// ── hasPendingVerification ──────────────────────────────────────────────────

describe('hasPendingVerification', () => {
  it('returns false when no pending code', async () => {
    mockGetMemory.mockResolvedValue(null);
    expect(await hasPendingVerification('user-1')).toBe(false);
  });

  it('returns true when code exists and not expired', async () => {
    mockGetMemory.mockImplementation((_userId: string, key: string) => {
      if (key === 'verification_code') return { value: '123456' };
      if (key === 'verification_expires') return { value: String(Date.now() + 600000) };
      return null;
    });
    expect(await hasPendingVerification('user-1')).toBe(true);
  });

  it('returns false and clears when expired', async () => {
    mockGetMemory.mockImplementation((_userId: string, key: string) => {
      if (key === 'verification_code') return { value: '123456' };
      if (key === 'verification_expires') return { value: String(Date.now() - 1000) };
      return null;
    });

    expect(await hasPendingVerification('user-1')).toBe(false);
    expect(mockDeleteMemory).toHaveBeenCalled();
  });
});

// ── verifyCode ──────────────────────────────────────────────────────────────

describe('verifyCode', () => {
  it('fails when no pending verification', async () => {
    mockGetMemory.mockResolvedValue(null);

    const result = await verifyCode('user-1', '123456');
    expect(result.success).toBe(false);
    expect(result.error).toContain('No pending verification');
  });

  it('fails when code has expired', async () => {
    mockGetMemory.mockImplementation((_userId: string, key: string) => {
      if (key === 'verification_code') return { value: '123456' };
      if (key === 'verification_email') return { value: 'rony@edlight.org' };
      if (key === 'verification_expires') return { value: String(Date.now() - 1000) };
      if (key === 'verification_attempts') return { value: '0' };
      return null;
    });

    const result = await verifyCode('user-1', '123456');
    expect(result.success).toBe(false);
    expect(result.error).toContain('expired');
  });

  it('fails on wrong code and increments attempts', async () => {
    mockGetMemory.mockImplementation((_userId: string, key: string) => {
      if (key === 'verification_code') return { value: '123456' };
      if (key === 'verification_email') return { value: 'rony@edlight.org' };
      if (key === 'verification_expires') return { value: String(Date.now() + 600000) };
      if (key === 'verification_attempts') return { value: '0' };
      return null;
    });

    const result = await verifyCode('user-1', '999999');
    expect(result.success).toBe(false);
    expect(result.error).toContain('isn\'t right');
    // Should save incremented attempts
    expect(mockSaveMemory).toHaveBeenCalledWith('user-1', expect.objectContaining({
      key: 'verification_attempts',
      value: '1',
    }));
  });

  it('succeeds on correct code and links identity', async () => {
    mockGetMemory.mockImplementation((_userId: string, key: string) => {
      if (key === 'verification_code') return { value: '123456' };
      if (key === 'verification_email') return { value: 'rony@edlight.org' };
      if (key === 'verification_expires') return { value: String(Date.now() + 600000) };
      if (key === 'verification_attempts') return { value: '0' };
      return null;
    });
    mockGetUserByEmail.mockResolvedValue({
      id: 'u1',
      email: 'rony@edlight.org',
      name: 'Rony Francillon',
      isAdmin: false,
      suspended: false,
    });

    const result = await verifyCode('user-1', '123456');
    expect(result.success).toBe(true);
    expect(result.email).toBe('rony@edlight.org');
    expect(result.name).toBe('Rony Francillon');
    // Should clear pending verification (4 delete calls)
    expect(mockDeleteMemory).toHaveBeenCalledTimes(4);
  });

  it('locks out after max attempts', async () => {
    mockGetMemory.mockImplementation((_userId: string, key: string) => {
      if (key === 'verification_code') return { value: '123456' };
      if (key === 'verification_email') return { value: 'rony@edlight.org' };
      if (key === 'verification_expires') return { value: String(Date.now() + 600000) };
      if (key === 'verification_attempts') return { value: '3' };
      return null;
    });

    const result = await verifyCode('user-1', '999999');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Too many attempts');
    expect(mockDeleteMemory).toHaveBeenCalled(); // Cleared
  });
});
