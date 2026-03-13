// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

describe('ChatInput', () => {
  it('renders with placeholder text', async () => {
    const { ChatInput } = await import('../chat-input');
    render(<ChatInput onSend={vi.fn()} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('calls onSend with message when Enter is pressed', async () => {
    const onSend = vi.fn();
    const { ChatInput } = await import('../chat-input');
    render(<ChatInput onSend={onSend} />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(onSend).toHaveBeenCalledWith('Hello');
  });

  it('does not submit on Shift+Enter', async () => {
    const onSend = vi.fn();
    const { ChatInput } = await import('../chat-input');
    render(<ChatInput onSend={onSend} />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('send button is disabled when input is empty', async () => {
    const { ChatInput } = await import('../chat-input');
    render(<ChatInput onSend={vi.fn()} />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('send button is disabled when loading', async () => {
    const { ChatInput } = await import('../chat-input');
    render(<ChatInput onSend={vi.fn()} isLoading={true} />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Hello' } });

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('does not call onSend for empty input', async () => {
    const onSend = vi.fn();
    const { ChatInput } = await import('../chat-input');
    render(<ChatInput onSend={onSend} />);

    const textarea = screen.getByRole('textbox');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(onSend).not.toHaveBeenCalled();
  });
});
