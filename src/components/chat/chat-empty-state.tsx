'use client';

import { useEffect, useState } from 'react';
import { OracleOrb } from '@/components/ui/oracle-orb';

const AGENT_NAME = 'Sandra';

interface Suggestion {
  text: string;
  icon: string;
}

const SUGGESTED_QUESTIONS: Record<string, Suggestion[]> = {
  en: [
    { text: 'What can you help me with?', icon: 'help' },
    { text: 'What tools do you have?', icon: 'build' },
    { text: 'Search the knowledge base', icon: 'search' },
    { text: 'Show me available programs', icon: 'apps' },
  ],
  fr: [
    { text: "Comment pouvez-vous m'aider ?", icon: 'help' },
    { text: 'Quels outils avez-vous ?', icon: 'build' },
    { text: 'Chercher dans la base de connaissances', icon: 'search' },
    { text: 'Montrer les programmes disponibles', icon: 'apps' },
  ],
  ht: [
    { text: 'Kisa ou ka ede mwen ak?', icon: 'help' },
    { text: 'Ki zouti ou genyen?', icon: 'build' },
    { text: 'Chèche nan baz konesans la', icon: 'search' },
    { text: 'Montre pwogram ki disponib yo', icon: 'apps' },
  ],
};

interface ChatEmptyStateProps {
  onSend?: (message: string) => void;
  language?: string;
  isLoading?: boolean;
}

const GREETING: Record<string, { title: string; subtitle: string }> = {
  en: {
    title: "Hi, I'm",
    subtitle: 'Ask me anything — I can search, schedule, email, and more',
  },
  fr: {
    title: 'Bonjour, je suis',
    subtitle: "Posez-moi une question — je peux rechercher, planifier, envoyer des e-mails et plus.",
  },
  ht: {
    title: 'Bonjou, mwen se',
    subtitle: 'Mande m nenpòt bagay — mwen ka chèche, planifye, voye imel, ak plis.',
  },
};

export function ChatEmptyState({ onSend, language = 'en', isLoading = false }: ChatEmptyStateProps) {
  const [bucket, setBucket] = useState(0);
  const allQuestions = SUGGESTED_QUESTIONS[language] ?? SUGGESTED_QUESTIONS['en']!;
  const greeting = GREETING[language] ?? GREETING['en']!;

  useEffect(() => {
    setBucket(Math.floor(Date.now() / 60_000) % 3);
  }, []);

  const questions: Suggestion[] = [
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
        {greeting.title}{' '}
        <span className="bg-gradient-to-r from-primary to-white bg-clip-text text-transparent">
          {AGENT_NAME}
        </span>
      </h2>
      <p className="relative mb-6 max-w-md text-center text-sm text-on-surface-variant/75 sm:mb-8">
        {greeting.subtitle}
      </p>

      {/* Suggestion cards */}
      <div className="relative grid w-full max-w-lg grid-cols-1 gap-2 min-[400px]:grid-cols-2">
        {questions.map(({ text, icon }) => (
          <button
            key={text}
            onClick={() => onSend?.(text)}
            className="group relative flex items-start gap-3 overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-low/30 px-4 py-3 text-left text-sm text-on-surface-variant backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:bg-surface-container/50 hover:text-on-surface active:scale-[0.98]"
            style={{ touchAction: 'manipulation' }}
          >
            {/* Hover glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/[0.03] to-primary/0 opacity-0 transition-opacity group-hover:opacity-100" />
            <span
              className="material-symbols-outlined relative shrink-0 text-[18px] text-primary/60 transition-colors group-hover:text-primary/80"
              style={{ fontVariationSettings: "'FILL' 0" }}
            >
              {icon}
            </span>
            <span className="relative leading-snug">{text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
