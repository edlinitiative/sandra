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
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      {/* Sandra mark */}
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-sandra-500 to-sandra-700">
        <svg className="h-6 w-6" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <circle cx="16" cy="16" r="4" fill="white" fillOpacity="0.9" />
          <circle cx="16" cy="16" r="8" stroke="white" strokeOpacity="0.35" strokeWidth="1.5" fill="none" />
          <circle cx="16" cy="16" r="12" stroke="white" strokeOpacity="0.15" strokeWidth="1" fill="none" strokeDasharray="4 6" />
        </svg>
      </div>

      <h2 className="mb-1 text-xl font-semibold text-white">
        How can I help?
      </h2>
      <p className="mb-8 text-sm text-slate-500">
        Ask about EdLight programs, courses, or opportunities
      </p>

      {/* Suggestion cards */}
      <div className="grid w-full max-w-lg gap-2 sm:grid-cols-2">
        {questions.map((text) => (
          <button
            key={text}
            onClick={() => onSend?.(text)}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left text-sm text-slate-400 transition-all hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-slate-200 active:scale-[0.98]"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
