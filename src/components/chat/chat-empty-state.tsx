'use client';

import { useEffect, useState } from 'react';
import { OracleOrb } from '@/components/ui/oracle-orb';

const AGENT_NAME = 'Sandra';

const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  en: [
    'What can you help me with?',
    'What tools do you have?',
    'Search the knowledge base',
    'Show me available programs',
  ],
  fr: [
    "Comment pouvez-vous m'aider ?",
    'Quels outils avez-vous ?',
    'Chercher dans la base de connaissances',
    'Montrer les programmes disponibles',
  ],
  ht: [
    'Kisa ou ka ede mwen ak?',
    'Ki zouti ou genyen?',
    'Chèche nan baz konesans la',
    'Montre pwogram ki disponib yo',
  ],
};

interface ChatEmptyStateProps {
  onSend?: (message: string) => void;
  language?: string;
  isLoading?: boolean;
}

export function ChatEmptyState({ onSend, language = 'en', isLoading = false }: ChatEmptyStateProps) {
  const [bucket, setBucket] = useState(0);
  const allQuestions = SUGGESTED_QUESTIONS[language] ?? SUGGESTED_QUESTIONS['en']!;

  useEffect(() => {
    setBucket(Math.floor(Date.now() / 60_000) % 3);
  }, []);

  const questions = [
    ...allQuestions.slice(bucket * 2),
    ...allQuestions.slice(0, bucket * 2),
  ].slice(0, 4);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-6 sm:py-16">
      {/* Ambient nebula background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="animate-nebula-drift absolute left-1/2 top-1/3 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.04] blur-[80px] sm:h-[300px] sm:w-[300px] sm:blur-[100px]"
        />
      </div>

      {/* Oracle orb — smaller on mobile */}
      <div className="relative mb-6 animate-orb-float sm:mb-8">
        <div className="sm:hidden"><OracleOrb size={80} active={isLoading} /></div>
        <div className="hidden sm:block"><OracleOrb size={120} active={isLoading} /></div>
      </div>

      {/* Greeting */}
      <h2 className="relative mb-1 text-lg font-semibold tracking-tight text-white sm:text-xl">
        Hi, I&apos;m{' '}
        <span className="bg-gradient-to-r from-primary to-white bg-clip-text text-transparent">
          {AGENT_NAME}
        </span>
      </h2>
      <p className="relative mb-6 text-sm text-on-surface-variant/70 sm:mb-8">
        Ask me anything — I can search, schedule, email, and more
      </p>

      {/* Suggestion cards */}
      <div className="relative grid w-full max-w-lg gap-2 grid-cols-1 min-[400px]:grid-cols-2">
        {questions.map((text) => (
          <button
            key={text}
            onClick={() => onSend?.(text)}
            className="group relative overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-low/20 px-4 py-3 text-left text-sm text-on-surface-variant backdrop-blur-sm transition-all hover:border-primary/20 hover:bg-surface-container/40 hover:text-on-surface active:scale-[0.98]"
          >
            {/* Hover glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/[0.03] to-primary/0 opacity-0 transition-opacity group-hover:opacity-100" />
            <span className="relative">{text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
