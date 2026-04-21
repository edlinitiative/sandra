'use client';

import Link from 'next/link';
import { OracleOrb } from '@/components/ui/oracle-orb';
import { APP_NAME } from '@/lib/config/constants';

/**
 * Slim header shown only on the /chat route on mobile.
 * Hides on sm+ where the full site header takes over.
 */
export function ChatHeader() {
  return (
    <div
      className="sm:hidden flex shrink-0 items-center justify-between border-b border-outline-variant/10 bg-surface/70 px-4 py-2 backdrop-blur-2xl"
      style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0px))' }}
    >
      {/* Back to home */}
      <Link
        href="/"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors active:bg-surface-container"
        aria-label="Back to home"
      >
        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
      </Link>

      {/* Centered title */}
      <div className="flex items-center gap-1.5">
        <OracleOrb size={18} />
        <span className="text-sm font-bold tracking-tight text-white">{APP_NAME}</span>
      </div>

      {/* Account */}
      <span className="material-symbols-outlined h-9 w-9 cursor-pointer p-1 text-[22px] text-on-surface-variant">
        account_circle
      </span>
    </div>
  );
}
