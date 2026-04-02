/**
 * Tests for private user tools.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db module
const mockUserFindUnique = vi.fn();
const mockEnrollmentFindMany = vi.fn();
const mockCertificateFindMany = vi.fn();
const mockApplicationFindMany = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    enrollment: {
      findMany: (...args: unknown[]) => mockEnrollmentFindMany(...args),
    },
    certificate: {
      findMany: (...args: unknown[]) => mockCertificateFindMany(...args),
    },
    programApplication: {
      findMany: (...args: unknown[]) => mockApplicationFindMany(...args),
    },
  },
}));

// Mock memory store
vi.mock('@/lib/memory/user-memory', () => ({
  getUserMemoryStore: () => ({
    getMemories: vi.fn().mockResolvedValue([
      { key: 'preferred_language', value: 'en', source: 'conversation', confidence: 0.8, updatedAt: new Date() },
    ]),
    getMemorySummary: vi.fn().mockResolvedValue(''),
    getMemory: vi.fn().mockResolvedValue(null),
    saveMemory: vi.fn().mockResolvedValue(undefined),
    deleteMemory: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Import tools (they self-register)
import '../get-user-profile';
import '../get-user-enrollments';
import '../get-user-certificates';
import '../get-application-status';
import { toolRegistry } from '../registry';
import type { ToolContext } from '../types';

const authenticatedContext: ToolContext = {
  sessionId: 'session-1',
  userId: 'user-1',
  scopes: ['knowledge:read', 'repos:read', 'profile:read', 'enrollments:read', 'certificates:read', 'applications:read'],
};

const anonymousContext: ToolContext = {
  sessionId: 'session-2',
  scopes: ['knowledge:read', 'repos:read'],
};

describe('getUserProfileSummary', () => {
  const tool = toolRegistry.get('getUserProfileSummary')!;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is registered', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('profile:read');
  });

  it('returns error for anonymous users', async () => {
    const result = await tool.handler({}, anonymousContext);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not authenticated');
  });

  it('returns profile for authenticated users', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      id: 'user-1',
      name: 'Test User',
      email: 'test@edlight.org',
      role: 'student',
      language: 'en',
      channel: 'web',
      createdAt: new Date('2026-01-01'),
      _count: { enrollments: 2, certificates: 1, applications: 1 },
    });

    const result = await tool.handler({}, authenticatedContext);
    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).name).toBe('Test User');
    expect((result.data as Record<string, unknown>).enrollmentCount).toBe(2);
  });
});

describe('getUserEnrollments', () => {
  const tool = toolRegistry.get('getUserEnrollments')!;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is registered', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('enrollments:read');
  });

  it('returns error for anonymous users', async () => {
    const result = await tool.handler({}, anonymousContext);
    expect(result.success).toBe(false);
  });

  it('returns enrollments for authenticated users', async () => {
    mockEnrollmentFindMany.mockResolvedValueOnce([
      {
        id: 'enr-1',
        courseName: 'Intro to Python',
        courseId: 'course-1',
        platform: 'academy',
        status: 'active',
        enrolledAt: new Date(),
        completedAt: null,
      },
    ]);

    const result = await tool.handler({}, authenticatedContext);
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect((data.enrollments as unknown[]).length).toBe(1);
    expect(data.count).toBe(1);
  });

  it('filters by platform', async () => {
    mockEnrollmentFindMany.mockResolvedValueOnce([]);

    await tool.handler({ platform: 'code' }, authenticatedContext);
    expect(mockEnrollmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ platform: 'code' }),
      }),
    );
  });

  it('returns friendly message when no enrollments', async () => {
    mockEnrollmentFindMany.mockResolvedValueOnce([]);

    const result = await tool.handler({}, authenticatedContext);
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.count).toBe(0);
    expect(data.message).toContain('No enrollments found');
  });
});

describe('getUserCertificates', () => {
  const tool = toolRegistry.get('getUserCertificates')!;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is registered', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('certificates:read');
  });

  it('returns certificates for authenticated users', async () => {
    mockCertificateFindMany.mockResolvedValueOnce([
      {
        id: 'cert-1',
        courseName: 'Web Development',
        platform: 'code',
        issuedAt: new Date(),
        certificateUrl: 'https://edlight.org/certificates/cert-1',
      },
    ]);

    const result = await tool.handler({}, authenticatedContext);
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect((data.certificates as unknown[]).length).toBe(1);
  });

  it('returns error for anonymous users', async () => {
    const result = await tool.handler({}, anonymousContext);
    expect(result.success).toBe(false);
  });
});

describe('getApplicationStatus', () => {
  const tool = toolRegistry.get('getApplicationStatus')!;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is registered', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('applications:read');
  });

  it('returns applications for authenticated users', async () => {
    mockApplicationFindMany.mockResolvedValueOnce([
      {
        id: 'app-1',
        programName: 'ESLP',
        programId: 'prog-1',
        status: 'under_review',
        appliedAt: new Date(),
        reviewedAt: null,
      },
    ]);

    const result = await tool.handler({}, authenticatedContext);
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect((data.applications as unknown[]).length).toBe(1);
  });

  it('filters by program name', async () => {
    mockApplicationFindMany.mockResolvedValueOnce([]);

    await tool.handler({ programName: 'ESLP' }, authenticatedContext);
    expect(mockApplicationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ programName: 'ESLP' }),
      }),
    );
  });

  it('returns error for anonymous users', async () => {
    const result = await tool.handler({}, anonymousContext);
    expect(result.success).toBe(false);
  });
});
