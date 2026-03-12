import { describe, it, expect } from 'vitest';
import { mockPrismaClient } from './mocks/prisma';
import { mockAIProvider } from './mocks/ai-provider';
import { createTestSession, createTestMessage, createTestUser } from './helpers';

describe('Test infrastructure smoke test', () => {
  it('mock Prisma client is importable and has expected model stubs', () => {
    expect(mockPrismaClient).toBeDefined();
    expect(typeof mockPrismaClient.session.create).toBe('function');
    expect(typeof mockPrismaClient.session.findUnique).toBe('function');
    expect(typeof mockPrismaClient.message.create).toBe('function');
    expect(typeof mockPrismaClient.message.findMany).toBe('function');
    expect(typeof mockPrismaClient.user.create).toBe('function');
    expect(typeof mockPrismaClient.repoRegistry.findMany).toBe('function');
  });

  it('mock AIProvider is importable and implements AIProvider interface', () => {
    expect(mockAIProvider).toBeDefined();
    expect(mockAIProvider.name).toBe('mock');
    expect(typeof mockAIProvider.chatCompletion).toBe('function');
    expect(typeof mockAIProvider.generateEmbeddings).toBe('function');
    expect(typeof mockAIProvider.healthCheck).toBe('function');
  });

  it('mock AIProvider returns canned responses', async () => {
    const response = await mockAIProvider.chatCompletion({
      messages: [{ role: 'user', content: 'hello' }],
    });
    expect(response.content).toBe('This is a mock response.');
    expect(response.finishReason).toBe('stop');
    expect(response.toolCalls).toEqual([]);
  });

  it('mock AIProvider healthCheck returns true', async () => {
    const healthy = await mockAIProvider.healthCheck();
    expect(healthy).toBe(true);
  });

  it('createTestSession returns valid session fixture', () => {
    const session = createTestSession();
    expect(session.id).toBe('test-session-id');
    expect(session.channel).toBe('web');
    expect(session.language).toBe('en');
    expect(session.isActive).toBe(true);
  });

  it('createTestSession accepts overrides', () => {
    const session = createTestSession({ id: 'custom-id', language: 'fr' });
    expect(session.id).toBe('custom-id');
    expect(session.language).toBe('fr');
  });

  it('createTestMessage returns valid message fixture', () => {
    const message = createTestMessage();
    expect(message.id).toBe('test-message-id');
    expect(message.role).toBe('user');
    expect(message.content).toBe('Hello, Sandra!');
  });

  it('createTestUser returns valid user fixture', () => {
    const user = createTestUser();
    expect(user.id).toBe('test-user-id');
    expect(user.email).toBe('test@example.com');
    expect(user.language).toBe('en');
  });
});
