'use client';

/** Map internal tool names to user-friendly labels */
const TOOL_LABELS: Record<string, string> = {
  searchKnowledgeBase:       'Searching knowledge base',
  getEdLightInitiatives:     'Looking up EdLight platforms',
  lookupRepoInfo:            'Looking up repositories',
  getCourseInventory:        'Looking up courses',
  getProgramsAndScholarships:'Looking up programs',
  getLatestNews:             'Checking latest news',
  getProgramDeadlines:       'Checking deadlines',
  getContactInfo:            'Looking up contact info',
};

interface StreamingMessageProps {
  content: string;
  activeToolCall?: string | null;
}

export function StreamingMessage({ content, activeToolCall }: StreamingMessageProps) {
  const toolLabel = activeToolCall ? (TOOL_LABELS[activeToolCall] ?? 'Working') : null;
  const DELAYS = [0, 120, 240, 120, 0];
  const MINI_DELAYS = [0, 150, 300];

  return (
    <div className="flex gap-3">
      {/* Sandra orb avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sandra-500 to-sandra-700 text-xs font-bold text-white glow-blue-sm animate-glow-pulse">
        S
      </div>

      <div className="max-w-[80%] items-start">
        {/* Tool call status with mini soundwave */}
        {toolLabel && (
          <div className="mb-1.5 flex items-center gap-2 text-xs text-sandra-400">
            <div className="flex h-3 items-center gap-[2px]">
              {MINI_DELAYS.map((delay, i) => (
                <div
                  key={i}
                  className="w-[2px] h-full rounded-full bg-sandra-400 soundwave-bar"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
            <span>{toolLabel}…</span>
          </div>
        )}

        {/* Message bubble */}
        <div className="rounded-2xl rounded-bl-sm glass border-l-2 border-l-sandra-500/50 px-4 py-2.5 text-sm leading-relaxed text-slate-200">
          {content ? (
            <>
              <span className="whitespace-pre-wrap">{content}</span>
              {/* Neon blinking cursor */}
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-sandra-400 align-middle" />
            </>
          ) : (
            /* Soundwave when waiting for content */
            <div className="flex h-5 items-center gap-[3px]">
              {DELAYS.map((delay, i) => (
                <div
                  key={i}
                  className="w-[3px] h-full rounded-full bg-sandra-500/70 soundwave-bar"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
