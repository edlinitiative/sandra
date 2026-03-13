// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock scrollIntoView (not available in jsdom)
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock fetch before importing component
const mockFetch = vi.fn();
global.fetch = mockFetch;

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

describe('ChatContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: { response: 'Hello from Sandra!', sessionId: 'session-123' },
        meta: { requestId: 'req-123' },
      }),
    });
  });

  it('renders the empty state when no messages', async () => {
    const { ChatContainer } = await import('../chat-container');
    render(<ChatContainer />);
    // Empty state should show the greeting
    expect(screen.getByText(/Sandra/i)).toBeInTheDocument();
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
});
