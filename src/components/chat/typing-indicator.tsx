/** Minimal dots indicator — shown while waiting for Sandra's first token */
export function TypingIndicator() {
  return (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-center gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-container">
          <svg className="h-3 w-3" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <circle cx="16" cy="16" r="6" fill="white" fillOpacity="0.9" />
            <circle cx="16" cy="16" r="11" stroke="white" strokeOpacity="0.3" strokeWidth="1.5" fill="none" />
          </svg>
        </div>
        <span className="text-xs font-semibold text-on-surface-variant">Sandra</span>
      </div>
      <div className="flex items-center gap-1.5 py-2 pl-8">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-outline" style={{ animationDelay: '0ms' }} />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-outline" style={{ animationDelay: '150ms' }} />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-outline" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}
