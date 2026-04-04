/** Waveform soundwave bars — shown while waiting for Sandra's first token */
export function TypingIndicator() {
  const DELAYS = [0, 120, 240, 120, 0];
  return (
    <div className="flex gap-3">
      {/* Sandra orb avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sandra-500 to-sandra-700 text-xs font-bold text-white glow-blue-sm animate-glow-pulse">
        S
      </div>

      {/* Glass bubble with soundwave */}
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm glass px-4 py-3">
        <div className="flex h-5 items-center gap-[3px]">
          {DELAYS.map((delay, i) => (
            <div
              key={i}
              className="w-[3px] h-full rounded-full bg-sandra-400 soundwave-bar"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
