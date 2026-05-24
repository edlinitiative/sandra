'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$';

interface GlitchTextProps {
  text: string;
  className?: string;
}

export function GlitchText({ text, className }: GlitchTextProps) {
  const [display, setDisplay] = useState(text);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iterRef = useRef(0);
  const textRef = useRef(text);
  textRef.current = text;

  const scramble = useCallback(() => {
    const currentText = textRef.current;
    if (timerRef.current) clearInterval(timerRef.current);
    iterRef.current = 0;
    timerRef.current = setInterval(() => {
      iterRef.current += 0.4;
      setDisplay(
        currentText
          .split('')
          .map((ch, i) => {
            if (ch === ' ') return ' ';
            if (i < Math.floor(iterRef.current)) return ch;
            return CHARS[Math.floor(Math.random() * CHARS.length)] ?? ch;
          })
          .join(''),
      );
      if (iterRef.current >= currentText.length) {
        clearInterval(timerRef.current!);
        setDisplay(currentText);
      }
    }, 25);
  }, []);

  useEffect(() => {
    const t = setTimeout(scramble, 280);
    return () => {
      clearTimeout(t);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [text, scramble]);

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
