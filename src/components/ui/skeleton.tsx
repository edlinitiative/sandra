/**
 * Base skeleton shimmer block.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-surface-container-high/40 ${className ?? ''}`}
    />
  );
}

/** Skeleton for a single chat message bubble */
export function MessageSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && <Skeleton className="h-7 w-7 shrink-0 rounded-full" />}
      <div className={`flex max-w-[75%] flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
        <Skeleton className={`h-4 ${isUser ? 'w-48' : 'w-64'} rounded-xl`} />
        <Skeleton className={`h-4 ${isUser ? 'w-32' : 'w-52'} rounded-xl`} />
        {!isUser && <Skeleton className="h-4 w-40 rounded-xl" />}
      </div>
    </div>
  );
}

/** Skeleton for a chat history restore (3 alternating messages) */
export function ChatHistorySkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-3 py-6 sm:px-4">
      <MessageSkeleton isUser={false} />
      <MessageSkeleton isUser={true} />
      <MessageSkeleton isUser={false} />
      <MessageSkeleton isUser={true} />
      <MessageSkeleton isUser={false} />
    </div>
  );
}

/** Skeleton for a stat card in admin */
export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low/50 p-5">
      <Skeleton className="mb-3 h-3 w-20" />
      <Skeleton className="mb-2 h-7 w-16" />
      <Skeleton className="h-3 w-28" />
    </div>
  );
}

/** Skeleton for a table row */
export function TableRowSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-4 border-b border-outline-variant/10 px-4 py-3">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className={`h-3 flex-1 ${i === 0 ? 'max-w-[80px]' : ''}`} />
      ))}
    </div>
  );
}

/** Full admin dashboard loading skeleton */
export function AdminDashboardSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto p-4 sm:p-6">
      {/* Stat cards row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      {/* Table area */}
      <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low/30 overflow-hidden">
        <div className="border-b border-outline-variant/10 px-4 py-3">
          <Skeleton className="h-4 w-32" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} />)}
      </div>
    </div>
  );
}
