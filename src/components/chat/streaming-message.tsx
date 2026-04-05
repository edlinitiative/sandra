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

  return (
    <div className="py-2.5">
      {/* Sandra label row */}
      <div className="mb-1.5 flex items-center gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sandra-500 to-sandra-700">
          <svg className="h-3 w-3" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <circle cx="16" cy="16" r="6" fill="white" fillOpacity="0.9" />
            <circle cx="16" cy="16" r="11" stroke="white" strokeOpacity="0.3" strokeWidth="1.5" fill="none" />
          </svg>
        </div>
        <span className="text-xs font-semibold text-slate-500">Sandra</span>
      </div>

      <div className="pl-8">
        {/* Tool call indicator */}
        {toolLabel && (
          <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>{toolLabel}…</span>
          </div>
        )}

        {/* Content */}
        <div className="text-[15px] leading-[1.75] text-slate-200">
          {content ? (
            <>
              <span className="whitespace-pre-wrap">{content}</span>
              <span className="scan-cursor" />
            </>
          ) : (
            <div className="flex items-center gap-1.5 py-2">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-600" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-600" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-600" style={{ animationDelay: '300ms' }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
