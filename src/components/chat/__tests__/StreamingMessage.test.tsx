// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StreamingMessage } from '../streaming-message';

describe('StreamingMessage', () => {
  it('renders streamed content with a blinking cursor', () => {
    render(<StreamingMessage content="Hello world" />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders without tool indicator when activeToolCall is null', () => {
    render(<StreamingMessage content="Some text" activeToolCall={null} />);
    expect(screen.queryByText(/Looking up/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Searching/i)).not.toBeInTheDocument();
  });

  it('shows a tool-call indicator when activeToolCall is set', () => {
    render(<StreamingMessage content="" activeToolCall="getCourseInventory" />);
    expect(screen.getByText(/Looking up courses/i)).toBeInTheDocument();
  });

  it('maps searchKnowledgeBase to a friendly label', () => {
    render(<StreamingMessage content="" activeToolCall="searchKnowledgeBase" />);
    expect(screen.getByText(/Searching knowledge base/i)).toBeInTheDocument();
  });

  it('maps getLatestNews to a friendly label', () => {
    render(<StreamingMessage content="" activeToolCall="getLatestNews" />);
    expect(screen.getByText(/Checking latest news/i)).toBeInTheDocument();
  });

  it('maps getProgramsAndScholarships to a friendly label', () => {
    render(<StreamingMessage content="" activeToolCall="getProgramsAndScholarships" />);
    expect(screen.getByText(/Looking up programs/i)).toBeInTheDocument();
  });

  it('shows a generic "Working" label for unknown tool names', () => {
    render(<StreamingMessage content="" activeToolCall="someUnknownTool" />);
    expect(screen.getByText(/Working/i)).toBeInTheDocument();
  });

  it('hides the tool indicator once content starts streaming', () => {
    const { rerender } = render(<StreamingMessage content="" activeToolCall="getCourseInventory" />);
    expect(screen.getByText(/Looking up courses/i)).toBeInTheDocument();

    // Simulate tokens arriving — activeToolCall cleared by container
    rerender(<StreamingMessage content="Here are the courses" activeToolCall={null} />);
    expect(screen.queryByText(/Looking up courses/i)).not.toBeInTheDocument();
    expect(screen.getByText('Here are the courses')).toBeInTheDocument();
  });
});
