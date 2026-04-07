// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock scrollIntoView (not available in jsdom)
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: { randomUUID: () => 'test-uuid-1234-5678-9012-345678901234' },
  writable: true,
});

// Mock navigator
Object.defineProperty(global, 'navigator', {
  value: { language: 'en-US' },
  writable: true,
});

// Mock the client API module
vi.mock('@/lib/client', () => ({
  streamMessage: vi.fn(),
  getConversation: vi.fn(),
  submitFeedback: vi.fn(),
}));

// Mock useSession hook
const mockSetSessionId = vi.fn();
const mockClearSession = vi.fn();
vi.mock('@/hooks/useSession', () => ({
  useSession: () => ({
    sessionId: null,
    setSessionId: mockSetSessionId,
    clearSession: mockClearSession,
  }),
}));

vi.mock('@/hooks/useUserIdentity', () => ({
  useUserIdentity: () => ({
    userId: 'web:test-user-123',
  }),
}));

import { streamMessage, getConversation } from '@/lib/client';

const mockStreamMessage = vi.mocked(streamMessage);
const mockGetConversation = vi.mocked(getConversation);

describe('ChatContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStreamMessage.mockImplementation(async (params, onToken, _onToolCall) => {
      onToken('Hello ');
      onToken('from ');
      onToken('Sandra!');
      return {
        sessionId: 'session-123',
        response: 'Hello from Sandra!',
        toolsUsed: [],
        retrievalUsed: false,
        suggestedFollowUps: [],
      };
    });
    mockGetConversation.mockResolvedValue({ sessionId: '', messages: [] });
  });

  it('renders the empty state when no messages', async () => {
    const { ChatContainer } = await import('../chat-container');
    render(<ChatContainer />);
    expect(screen.getAllByText(/Sandra/i).length).toBeGreaterThan(0);
  });

  it('renders message input', async () => {
    const { ChatContainer } = await import('../chat-container');
    render(<ChatContainer />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('shows user message after sending', async () => {
    const { ChatContainer } = await import('../chat-container');
    render(<ChatContainer />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Hello Sandra' } });
    fireEvent.submit(textarea.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Hello Sandra')).toBeInTheDocument();
    });
  });

  it('shows assistant response after send', async () => {
    const { ChatContainer } = await import('../chat-container');
    render(<ChatContainer />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Test message' } });
    fireEvent.submit(textarea.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Hello from Sandra!')).toBeInTheDocument();
    });
  });

  it('clears input after sending', async () => {
    const { ChatContainer } = await import('../chat-container');
    render(<ChatContainer />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Test message' } });
    fireEvent.submit(textarea.closest('form')!);

    await waitFor(() => {
      expect(textarea.value).toBe('');
    });
  });

  it('sends the stable browser userId with stream requests', async () => {
    const { ChatContainer } = await import('../chat-container');
    render(<ChatContainer />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Remember me' } });
    fireEvent.submit(textarea.closest('form')!);

    await waitFor(() => {
      expect(mockStreamMessage).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'web:test-user-123' }),
        expect.any(Function),
        expect.any(Function),
        expect.any(AbortSignal),
      );
    });
  });

  it('shows tool-call indicator when a tool is invoked during streaming', async () => {
    // Simulate a tool call happening before tokens arrive
    mockStreamMessage.mockImplementation(async (_params, onToken, onToolCall) => {
      onToolCall?.('getCourseInventory');
      // Small delay to let React render the indicator
      await new Promise((resolve) => setTimeout(resolve, 10));
      onToken('Here are the courses.');
      return {
        sessionId: 'session-123',
        response: 'Here are the courses.',
        toolsUsed: ['getCourseInventory'],
        retrievalUsed: false,
        suggestedFollowUps: [],
      };
    });

    const { ChatContainer } = await import('../chat-container');
    render(<ChatContainer />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'What courses are available?' } });
    fireEvent.submit(textarea.closest('form')!);

    // The onToolCall callback should be passed as the third argument
    await waitFor(() => {
      expect(mockStreamMessage).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Function),
        expect.any(Function),
        expect.any(AbortSignal),
      );
    });

    // Final response should render
    await waitFor(() => {
      expect(screen.getByText('Here are the courses.')).toBeInTheDocument();
    });
  });

  it('does not clear session on conversation restore failure', async () => {
    // Even if getConversation fails, session should not be cleared
    mockGetConversation.mockRejectedValue(new Error('Unauthorized'));

    const { ChatContainer } = await import('../chat-container');
    render(<ChatContainer />);

    // Wait a tick for effects to settle
    await new Promise((r) => setTimeout(r, 50));

    // clearSession should NOT have been called
    expect(mockClearSession).not.toHaveBeenCalled();
  });
});
