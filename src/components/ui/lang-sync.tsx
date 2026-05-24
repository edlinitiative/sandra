'use client';

import { useEffect } from 'react';

export function LangSync() {
  useEffect(() => {
    const lang = localStorage.getItem('sandra-language') || 'en';
    document.documentElement.lang = lang;
  }, []);
  return null;
}
