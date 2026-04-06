import { useEffect, useState } from 'react';

// TODO: load from tenant config
const AGENT_NAME = 'Sandra';

const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  en: [
    'What can you help me with?',
    'What tools do you have?',
    'Search the knowledge base',
    'Show me available programs',
  ],
  fr: [
    'Comment pouvez-vous m\'aider ?',
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
}

export function ChatEmptyState({ onSend, language = 'en' }: ChatEmptyStateProps) {
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
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:py-16">
      {/* Sandra mark */}
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-container">
        <svg className="h-6 w-6" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <circle cx="16" cy="16" r="4" fill="white" fillOpacity="0.9" />
          <circle cx="16" cy="16" r="8" stroke="white" strokeOpacity="0.35" strokeWidth="1.5" fill="none" />
          <circle cx="16" cy="16" r="12" stroke="white" strokeOpacity="0.15" strokeWidth="1" fill="none" strokeDasharray="4 6" />
        </svg>
      </div>

      <h2 className="mb-1 text-xl font-semibold text-white">
        Hi, I&apos;m {AGENT_NAME}
      </h2>
      <p className="mb-5 text-sm text-on-surface-variant sm:mb-8">
        Ask me anything — I can search, schedule, email, and more
      </p>

      {/* Suggestion cards */}
      <div className="grid w-full max-w-lg gap-2 sm:grid-cols-2">
        {questions.map((text) => (
          <button
            key={text}
            onClick={() => onSend?.(text)}
            className="rounded-xl border border-outline-variant/15 bg-surface-container-low/30 px-4 py-3 text-left text-sm text-on-surface-variant transition-all hover:border-outline-variant/25 hover:bg-surface-container hover:text-on-surface active:scale-[0.98]"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
