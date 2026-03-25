'use client';

/** Map internal tool names to user-friendly labels */
const TOOL_LABELS: Record<string, string> = {
  searchKnowledgeBase: 'Searching knowledge base',
  getEdLightInitiatives: 'Looking up EdLight platforms',
  lookupRepoInfo: 'Looking up repositories',
  getCourseInventory: 'Looking up courses',
  getProgramsAndScholarships: 'Looking up programs',
  getLatestNews: 'Checking latest news',
  getProgramDeadlines: 'Checking deadlines',
  getContactInfo: 'Looking up contact info',
};

interface StreamingMessageProps {
  content: string;
  activeToolCall?: string | null;
}

export function StreamingMessage({ content, activeToolCall }: StreamingMessageProps) {
  const toolLabel = activeToolCall ? (TOOL_LABELS[activeToolCall] ?? 'Working') : null;

  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sandra-500 to-sandra-700 text-xs font-bold text-white">
        S
      </div>
      <div className="max-w-[80%] items-start">
        {toolLabel && (
          <div className="mb-1.5 flex items-center gap-1.5 text-xs text-sandra-600">
            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>{toolLabel}…</span>
          </div>
        )}
        <div className="rounded-2xl rounded-bl-md bg-gray-100 px-4 py-2.5 text-sm leading-relaxed text-gray-900">
          {content ? (
            <>
              <span className="whitespace-pre-wrap">{content}</span>
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-gray-500 align-middle" />
            </>
          ) : (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-gray-500 align-middle" />
          )}
        </div>
      </div>
    </div>
  );
}
