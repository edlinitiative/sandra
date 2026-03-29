interface TypingIndicatorProps {}

export function TypingIndicator(_props: TypingIndicatorProps) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sandra-500 to-sandra-700 text-xs font-bold text-white">
        S
      </div>
      <div className="rounded-2xl rounded-bl-md bg-gray-100 px-4 py-2.5">
        <div className="flex items-center gap-1 py-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
          <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
          <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
