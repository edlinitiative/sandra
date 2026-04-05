'use client';

import { useEffect, useRef, useState } from 'react';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$';

interface GlitchTextProps {
  text: string;
  className?: string;
}

export function GlitchText({ text, className }: GlitchTextProps) {
  const [display, setDisplay] = useState(text);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iterRef = useRef(0);

  const scramble = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    iterRef.current = 0;
    timerRef.current = setInterval(() => {
      iterRef.current += 0.4;
      setDisplay(
        text
          .split('')
          .map((ch, i) => {
            if (ch === ' ') return ' ';
            if (i < Math.floor(iterRef.current)) return ch;
            return CHARS[Math.floor(Math.random() * CHARS.length)] ?? ch;
          })
          .join(''),
      );
      if (iterRef.current >= text.length) {
        clearInterval(timerRef.current!);
        setDisplay(text);
      }
    }, 25);
  };

  useEffect(() => {
    const t = setTimeout(scramble, 280);
    return () => {
      clearTimeout(t);
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    // tabular-nums keeps layout stable while chars change width
    <span
      className={className}
      style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}
      onMouseEnter={scramble}
    >
      {display}
    </span>
  );
}
