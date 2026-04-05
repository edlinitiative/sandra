'use client';

import { useState } from 'react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  isLoading?: boolean;
  followUps?: string[];
  onFollowUp?: (message: string) => void;
  /** Client-assigned UUID for this response — used to link feedback */
  messageId?: string;
  /** Callback when user rates this response */
  onFeedback?: (messageId: string, rating: 'up' | 'down') => void;
}

/**
 * Lightweight markdown renderer — handles bold, inline code, code blocks,
 * bullet lists, numbered lists, and headings without a heavy dependency.
 */
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Fenced code blocks
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith('```')) {
        codeLines.push(lines[i]!);
        i++;
      }
      nodes.push(
        <pre
          key={i}
          className="my-2 overflow-x-auto rounded-lg border border-white/[0.07] bg-black/60 px-4 py-3 text-xs text-green-400"
        >
          <code>{codeLines.join('\n')}</code>
        </pre>,
      );
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1]!.length;
      const headingText = headingMatch[2]!;
      const cls =
        level === 1
          ? 'text-base font-bold mt-3 mb-1'
          : level === 2
            ? 'text-sm font-bold mt-2 mb-1'
            : 'text-sm font-semibold mt-1 mb-0.5';
      nodes.push(
        <p key={i} className={cls}>
          {inlineMarkdown(headingText)}
        </p>,
      );
      i++;
      continue;
    }

    // Unordered list
    if (line.match(/^[-*]\s+/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i]!.match(/^[-*]\s+/)) {
        items.push(lines[i]!.replace(/^[-*]\s+/, ''));
        i++;
      }
      nodes.push(
        <ul key={i} className="my-1.5 ml-4 list-disc space-y-0.5">
          {items.map((item, idx) => (
            <li key={idx}>{inlineMarkdown(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (line.match(/^\d+\.\s+/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i]!.match(/^\d+\.\s+/)) {
        items.push(lines[i]!.replace(/^\d+\.\s+/, ''));
        i++;
      }
      nodes.push(
        <ol key={i} className="my-1.5 ml-4 list-decimal space-y-0.5">
          {items.map((item, idx) => (
            <li key={idx}>{inlineMarkdown(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/)) {
      nodes.push(<hr key={i} className="my-2 border-white/10" />);
      i++;
      continue;
    }

    // Empty line — spacing
    if (line.trim() === '') {
      nodes.push(<div key={i} className="h-1.5" />);
      i++;
      continue;
    }

    // Normal paragraph
    nodes.push(
      <p key={i} className="leading-relaxed">
        {inlineMarkdown(line)}
      </p>,
    );
    i++;
  }

  return nodes;
}

function inlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[2]) {
      parts.push(<strong key={match.index}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={match.index}>{match[3]}</em>);
    } else if (match[4]) {
      parts.push(
        <code key={match.index} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-sandra-300 border border-white/[0.08]">
          {match[4]}
        </code>,
      );
    } else if (match[5] && match[6]) {
      parts.push(
        <a key={match.index} href={match[6]} target="_blank" rel="noopener noreferrer"
          className="text-sandra-400 underline decoration-dotted hover:decoration-solid">
          {match[5]}
        </a>,
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 ? parts[0] : parts;
}

export function ChatMessage({
  role,
  content,
  timestamp,
  isLoading,
  followUps,
  onFollowUp,
  messageId,
  onFeedback,
}: ChatMessageProps) {
  const isUser = role === 'user';
  const showFollowUps = !isUser && followUps && followUps.length > 0 && !isLoading;
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  function handleFeedback(rating: 'up' | 'down') {
    if (feedback || !messageId || !onFeedback) return;
    setFeedback(rating);
    onFeedback(messageId, rating);
  }

  return (
    <div className={`flex gap-3 animate-materialize ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          isUser
            ? 'bg-slate-700 text-slate-300'
            : 'bg-gradient-to-br from-sandra-500 to-sandra-700 text-white glow-blue-sm animate-glow-pulse'
        }`}
      >
        {isUser ? 'U' : 'S'}
      </div>

      {/* Message bubble + follow-ups */}
      <div className={`flex max-w-[80%] flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'rounded-br-sm bg-white/[0.08] border border-white/[0.10] text-slate-100'
              : 'rounded-bl-sm glass border-l-2 border-l-sandra-500/50 text-slate-200 hud'
          }`}
        >
          {isLoading ? (
            <div className="flex items-center gap-1 py-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-sandra-400" style={{ animationDelay: '0ms' }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-sandra-400" style={{ animationDelay: '150ms' }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-sandra-400" style={{ animationDelay: '300ms' }} />
            </div>
          ) : isUser ? (
            <div className="whitespace-pre-wrap">{content}</div>
          ) : (
            <div className="space-y-0.5">{renderMarkdown(content)}</div>
          )}
        </div>

        {timestamp && (
          <p className={`text-xs text-slate-600 ${isUser ? 'text-right' : ''}`}>
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}

        {/* Feedback thumbs — only on non-loading assistant messages */}
        {!isUser && !isLoading && messageId && onFeedback && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleFeedback('up')}
              disabled={!!feedback}
              title="Helpful"
              aria-label="Mark as helpful"
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                feedback === 'up'
                  ? 'border-green-300 bg-green-50 text-green-700'
                  : feedback
                    ? 'cursor-default border-gray-100 text-gray-300'
                    : 'border-gray-200 text-gray-400 hover:border-green-300 hover:text-green-600'
              }`}
            >
              👍{feedback === 'up' && <span className="ml-0.5">Thanks!</span>}
            </button>
            <button
              onClick={() => handleFeedback('down')}
              disabled={!!feedback}
              title="Not helpful"
              aria-label="Mark as not helpful"
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                feedback === 'down'
                  ? 'border-red-200 bg-red-50 text-red-600'
                  : feedback
                    ? 'cursor-default border-gray-100 text-gray-300'
                    : 'border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500'
              }`}
            >
              👎{feedback === 'down' && <span className="ml-0.5">Noted!</span>}
            </button>
          </div>
        )}

        {/* Follow-up suggestion chips */}
        {showFollowUps && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {followUps!.map((q) => (
              <button
                key={q}
                onClick={() => onFollowUp?.(q)}
                className="rounded-full border border-sandra-500/30 bg-white/[0.03] px-3 py-1 text-xs text-sandra-400 shadow-sm transition-all hover:border-sandra-400/60 hover:bg-sandra-500/10 hover:text-sandra-300 active:scale-95"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

