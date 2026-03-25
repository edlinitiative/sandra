// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

describe('ChatEmptyState', () => {
  it('renders benchmark-aligned starter prompts', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(0);
    const { ChatEmptyState } = await import('../chat-empty-state');
    render(<ChatEmptyState />);

    expect(screen.getByRole('button', { name: /what courses can i take on edlight/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /programs and opportunities/i })).toBeInTheDocument();
    nowSpy.mockRestore();
  });

  it('renders suggestion cards', async () => {
    const { ChatEmptyState } = await import('../chat-empty-state');
    render(<ChatEmptyState />);
    // Should have clickable suggestion buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('calls onSend when a suggestion is clicked', async () => {
    const onSend = vi.fn();
    const { ChatEmptyState } = await import('../chat-empty-state');
    render(<ChatEmptyState onSend={onSend} />);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]!);

    expect(onSend).toHaveBeenCalledWith(expect.any(String));
  });

  it('renders Sandra greeting', async () => {
    const { ChatEmptyState } = await import('../chat-empty-state');
    render(<ChatEmptyState />);
    expect(screen.getByText(/Sandra/i)).toBeInTheDocument();
  });

  it('does not call onSend when no handler provided', async () => {
    const { ChatEmptyState } = await import('../chat-empty-state');
    // Should not throw when onSend is not provided
    expect(() => {
      render(<ChatEmptyState />);
      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[0]!);
    }).not.toThrow();
  });
});
