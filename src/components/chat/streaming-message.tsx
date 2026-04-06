'use client';

import { OracleOrb } from '@/components/ui/oracle-orb';

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
        <div className="relative flex h-6 w-6 shrink-0 items-center justify-center">
          <OracleOrb size={24} active />
        </div>
        <span className="text-xs font-semibold text-on-surface-variant">Sandra</span>
      </div>

      <div className="pl-6 sm:pl-8">
        {/* Tool call indicator */}
        {toolLabel && (
          <div className="mb-2 flex items-center gap-2 text-xs text-on-surface-variant">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border border-primary/30 border-t-primary" />
            <span>{toolLabel}…</span>
          </div>
        )}

        {/* Content */}
        <div className="text-[15px] leading-[1.75] text-on-surface">
          {content ? (
            <>
              <span className="whitespace-pre-wrap">{content}</span>
              <span className="scan-cursor" />
            </>
          ) : (
            <div className="flex items-center gap-1.5 py-2">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-outline" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-outline" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-outline" style={{ animationDelay: '300ms' }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
