'use client';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  isLoading?: boolean;
  followUps?: string[];
  onFollowUp?: (message: string) => void;
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
          className="my-2 overflow-x-auto rounded-lg bg-gray-800 px-4 py-3 text-xs text-green-300"
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
      nodes.push(<hr key={i} className="my-2 border-gray-300" />);
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
        <code key={match.index} className="rounded bg-gray-200 px-1 py-0.5 font-mono text-xs text-gray-800">
          {match[4]}
        </code>,
      );
    } else if (match[5] && match[6]) {
      parts.push(
        <a key={match.index} href={match[6]} target="_blank" rel="noopener noreferrer"
          className="underline decoration-dotted hover:decoration-solid">
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
}: ChatMessageProps) {
  const isUser = role === 'user';
  const showFollowUps = !isUser && followUps && followUps.length > 0 && !isLoading;

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          isUser
            ? 'bg-gray-200 text-gray-600'
            : 'bg-gradient-to-br from-sandra-500 to-sandra-700 text-white'
        }`}
      >
        {isUser ? 'U' : 'S'}
      </div>

      {/* Message bubble + follow-ups */}
      <div className={`flex max-w-[80%] flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'bg-sandra-600 text-white rounded-br-md'
              : 'bg-gray-100 text-gray-900 rounded-bl-md'
          }`}
        >
          {isLoading ? (
            <div className="flex items-center gap-1 py-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
            </div>
          ) : isUser ? (
            <div className="whitespace-pre-wrap">{content}</div>
          ) : (
            <div className="space-y-0.5">{renderMarkdown(content)}</div>
          )}
        </div>

        {timestamp && (
          <p className={`text-xs text-gray-400 ${isUser ? 'text-right' : ''}`}>
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}

        {/* Follow-up suggestion chips */}
        {showFollowUps && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {followUps!.map((q) => (
              <button
                key={q}
                onClick={() => onFollowUp?.(q)}
                className="rounded-full border border-sandra-200 bg-white px-3 py-1 text-xs text-sandra-700 shadow-sm transition-all hover:border-sandra-400 hover:bg-sandra-50 active:scale-95"
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

