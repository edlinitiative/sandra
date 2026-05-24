'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

const USER_ID_KEY = 'sandra_user_id';
const USER_ID_PREFIX = 'web:';

function createAnonymousUserId(): string {
  return `${USER_ID_PREFIX}${crypto.randomUUID()}`;
}

export function useUserIdentity(): { userId: string | null; isResolving: boolean } {
  const { data: session, status } = useSession();
  const [anonymousId, setAnonymousId] = useState<string | null>(null);

  // Generate / restore anonymous ID for unauthenticated users
  useEffect(() => {
    if (status !== 'unauthenticated') return;
    try {
      const stored = localStorage.getItem(USER_ID_KEY);
      if (stored) {
        setAnonymousId(stored);
        return;
      }
      const generated = createAnonymousUserId();
      localStorage.setItem(USER_ID_KEY, generated);
      setAnonymousId(generated);
    } catch {
      setAnonymousId(createAnonymousUserId());
    }
  }, [status]);

  // When authenticated, use the Sandra user ID from the session
  if (status === 'authenticated') {
    return { userId: session?.user?.id ?? null, isResolving: false };
  }

  // Session is still loading — wait before resolving identity
  if (status === 'loading') {
    return { userId: null, isResolving: true };
  }

  return { userId: anonymousId, isResolving: anonymousId === null };
}
