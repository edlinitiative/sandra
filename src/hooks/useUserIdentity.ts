'use client';

import { useEffect, useState } from 'react';

const USER_ID_KEY = 'sandra_user_id';
const USER_ID_PREFIX = 'web:';

function createAnonymousUserId(): string {
  return `${USER_ID_PREFIX}${crypto.randomUUID()}`;
}

export function useUserIdentity(): { userId: string | null } {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(USER_ID_KEY);
      if (stored) {
        setUserId(stored);
        return;
      }

      const generated = createAnonymousUserId();
      localStorage.setItem(USER_ID_KEY, generated);
      setUserId(generated);
    } catch {
      setUserId(createAnonymousUserId());
    }
  }, []);

  return { userId };
}
