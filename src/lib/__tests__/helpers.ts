/**
 * Test fixture factories.
 * Provide sensible defaults; pass overrides to customise.
 */

export interface TestSession {
  id: string;
  userId: string | null;
  channel: string;
  language: string;
  title: string | null;
  metadata: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestMessage {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  language: string | null;
  toolName: string | null;
  toolCallId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface TestUser {
  id: string;
  externalId: string | null;
  name: string | null;
  email: string | null;
  language: string;
  channel: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Factory for test Session objects */
export function createTestSession(overrides: Partial<TestSession> = {}): TestSession {
  return {
    id: 'test-session-id',
    userId: null,
    channel: 'web',
    language: 'en',
    title: null,
    metadata: null,
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

/** Factory for test Message objects */
export function createTestMessage(overrides: Partial<TestMessage> = {}): TestMessage {
  return {
    id: 'test-message-id',
    sessionId: 'test-session-id',
    role: 'user',
    content: 'Hello, Sandra!',
    language: 'en',
    toolName: null,
    toolCallId: null,
    metadata: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

/** Factory for test User objects */
export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: 'test-user-id',
    externalId: null,
    name: 'Test User',
    email: 'test@example.com',
    language: 'en',
    channel: 'web',
    metadata: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}
