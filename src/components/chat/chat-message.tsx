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
    <div className="group animate-fade-up py-2.5">
      {isUser ? (
        /* ── User message — right-aligned pill ── */
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-3xl bg-white/[0.07] px-4 py-2.5 text-[15px] leading-relaxed text-slate-100 sm:max-w-[70%]">
            <div className="whitespace-pre-wrap">{content}</div>
          </div>
        </div>
      ) : (
        /* ── Sandra message — icon + label + content ── */
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sandra-500 to-sandra-700">
              <svg className="h-3 w-3" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <circle cx="16" cy="16" r="6" fill="white" fillOpacity="0.9" />
                <circle cx="16" cy="16" r="11" stroke="white" strokeOpacity="0.3" strokeWidth="1.5" fill="none" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-slate-500">Sandra</span>
          </div>

          <div className="pl-8 text-[15px] leading-[1.75] text-slate-200">
            {isLoading ? (
              <div className="flex items-center gap-1.5 py-2">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-600" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-600" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-600" style={{ animationDelay: '300ms' }} />
              </div>
            ) : (
              <div className="space-y-1">{renderMarkdown(content)}</div>
            )}
          </div>

          {/* Feedback — small thumbs */}
          {!isLoading && messageId && onFeedback && (
            <div className="mt-1.5 flex items-center gap-0.5 pl-8">
              <button
                onClick={() => handleFeedback('up')}
                disabled={!!feedback}
                title="Helpful"
                className={`rounded-md px-1.5 py-1 text-xs transition-colors ${
                  feedback === 'up'
                    ? 'text-sandra-400'
                    : feedback
                      ? 'cursor-default text-slate-800'
                      : 'text-slate-600 hover:bg-white/[0.04] hover:text-slate-300'
                }`}
              >
                👍
              </button>
              <button
                onClick={() => handleFeedback('down')}
                disabled={!!feedback}
                title="Not helpful"
                className={`rounded-md px-1.5 py-1 text-xs transition-colors ${
                  feedback === 'down'
                    ? 'text-red-400'
                    : feedback
                      ? 'cursor-default text-slate-800'
                      : 'text-slate-600 hover:bg-white/[0.04] hover:text-slate-300'
                }`}
              >
                👎
              </button>
            </div>
          )}

          {/* Follow-up suggestion chips */}
          {showFollowUps && (
            <div className="mt-3 flex flex-wrap gap-2 pl-8">
              {followUps!.map((q) => (
                <button
                  key={q}
                  onClick={() => onFollowUp?.(q)}
                  className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400 transition-all hover:border-white/[0.15] hover:bg-white/[0.06] hover:text-slate-200 active:scale-95"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {timestamp && (
        <p className={`mt-1 text-[10px] text-slate-700 ${isUser ? 'text-right' : 'pl-8'}`}>
          {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  );
}

