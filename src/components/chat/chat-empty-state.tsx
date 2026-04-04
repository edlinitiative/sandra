import { useEffect, useState } from 'react';

const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  en: [
    'What courses can I take on EdLight?',
    'What programs and opportunities does EdLight offer?',
    'Tell me about the EdLight Summer Leadership Program',
    'Where should a complete beginner start learning to code?',
    'What is EdLight Academy?',
    "What's new at EdLight?",
  ],
  fr: [
    'Quels cours puis-je suivre sur EdLight ?',
    'Quels programmes et opportunités EdLight offre-t-il ?',
    "Parlez-moi du Programme de Leadership d'\u00c9t\u00e9 EdLight",
    'Par o\u00f9 un d\u00e9butant complet devrait-il commencer \u00e0 apprendre \u00e0 coder\u00a0?',
    "Qu'est-ce qu'EdLight Academy\u00a0?",
    'Quoi de neuf chez EdLight\u00a0?',
  ],
  ht: [
    'Ki kou mwen ka suiv sou EdLight?',
    'Ki pwogram ak opotinite EdLight ofri?',
    'Pale mwen sou Pwogram Lid\u00e8chip Et\u00e9 EdLight la',
    'Ki kote yon debutant n\u00e8t ta dwe k\u00f2manse aprann kode?',
    'Kisa EdLight Academy ye?',
    'Ki sa ki nouvo nan EdLight?',
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
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
      {/* Sandra Orb with rings */}
      <div className="relative mb-8 flex items-center justify-center">
        {/* Outermost expanding ring */}
        <div className="absolute h-40 w-40 rounded-full border border-sandra-500/15 animate-ring-out" />
        {/* Second expanding ring (delayed) */}
        <div className="absolute h-40 w-40 rounded-full border border-sandra-400/10 animate-ring-out-delayed" />
        {/* Static ambient halo */}
        <div className="absolute h-28 w-28 rounded-full bg-sandra-500/8 blur-xl" />
        {/* The orb */}
        <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-sandra-400 to-sandra-700 animate-glow-pulse animate-orb-float shadow-2xl">
          <svg
            className="h-9 w-9 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
            />
          </svg>
        </div>
      </div>

      <h2 className="mb-2 text-2xl font-bold text-white">
        Hi, I&apos;m Sandra
      </h2>
      <p className="mb-8 max-w-sm text-sm leading-relaxed text-slate-400">
        AI assistant for the EdLight ecosystem — fluent in English, Fran\u00e7ais, and Kr\u00e8y\u00f2l Ayisyen.
      </p>

      {/* Suggestion cards */}
      <div className="grid w-full max-w-lg gap-2 sm:grid-cols-2">
        {questions.map((text) => (
          <SuggestionCard key={text} text={text} onSend={onSend} />
        ))}
      </div>
    </div>
  );
}

function SuggestionCard({
  text,
  onSend,
}: {
  text: string;
  onSend?: (message: string) => void;
}) {
  return (
    <button
      onClick={() => onSend?.(text)}
      className="glass rounded-xl px-4 py-3 text-left text-sm text-slate-300 transition-all duration-200 hover:border-sandra-500/35 hover:bg-white/[0.07] hover:text-white active:scale-[0.97]"
    >
      <span className="mr-1.5 text-sandra-400">&#8594;</span>
      {text}
    </button>
  );
}
