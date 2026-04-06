'use client';

import { OracleOrb } from '@/components/ui/oracle-orb';

/** Oracle orb thinking indicator — shown while waiting for the first token */
export function TypingIndicator() {
  return (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-center gap-2">
        <div className="relative flex h-6 w-6 shrink-0 items-center justify-center">
          <OracleOrb size={24} active />
        </div>
        <span className="text-xs font-semibold text-on-surface-variant">Sandra</span>
      </div>
      <div className="flex items-center gap-2 py-2 pl-8">
        <div className="flex items-center gap-1.5">
          <span className="h-1 w-1 animate-pulse rounded-full bg-primary/60" style={{ animationDelay: '0ms' }} />
          <span className="h-1 w-1 animate-pulse rounded-full bg-primary/60" style={{ animationDelay: '200ms' }} />
          <span className="h-1 w-1 animate-pulse rounded-full bg-primary/60" style={{ animationDelay: '400ms' }} />
        </div>
        <span className="text-xs text-on-surface-variant/50">Thinking…</span>
      </div>
    </div>
  );
}
