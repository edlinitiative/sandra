'use client';

import { useState, useEffect } from 'react';

const SESSION_KEY = 'sandra_session_id';

export interface UseSessionReturn {
  sessionId: string | null;
  setSessionId: (id: string) => void;
  clearSession: () => void;
}

/**
 * Hook for persisting the chat session ID in localStorage.
 * Restores the session across page reloads.
 */
export function useSession(): UseSessionReturn {
  const [sessionId, setSessionIdState] = useState<string | null>(null);

  // Read from localStorage on mount (client-side only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        setSessionIdState(stored);
      }
    } catch {
      // localStorage may not be available (SSR or privacy mode)
    }
  }, []);

  const setSessionId = (id: string) => {
    try {
      localStorage.setItem(SESSION_KEY, id);
    } catch {
      // Ignore storage errors
    }
    setSessionIdState(id);
  };

  const clearSession = () => {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // Ignore storage errors
    }
    setSessionIdState(null);
  };

  return { sessionId, setSessionId, clearSession };
}
