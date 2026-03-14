const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  en: [
    'What is EdLight?',
    'Tell me about EdLight Academy',
    'How can EdLight help my school?',
    'What resources does EdLight offer?',
  ],
  fr: [
    "Qu'est-ce qu'EdLight?",
    "Parlez-moi d'EdLight Academy",
    'Comment EdLight peut-il aider mon école?',
    "Quelles ressources EdLight offre-t-il?",
  ],
  ht: [
    'Kisa EdLight ye?',
    'Pale mwen sou EdLight Academy',
    'Kijan EdLight ka ede lekòl mwen?',
    'Ki resous EdLight ofri?',
  ],
};

interface ChatEmptyStateProps {
  onSend?: (message: string) => void;
  language?: string;
}

export function ChatEmptyState({ onSend, language = 'en' }: ChatEmptyStateProps) {
  const questions = SUGGESTED_QUESTIONS[language] ?? SUGGESTED_QUESTIONS['en']!;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-sandra-500 to-sandra-700 text-white shadow-lg">
        <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
          />
        </svg>
      </div>
      <h2 className="mb-2 text-2xl font-bold text-gray-900">Hi, I&apos;m Sandra</h2>
      <p className="mb-6 max-w-md text-gray-500">
        I&apos;m the AI assistant for the EdLight ecosystem. I can help you with questions about
        EdLight platforms, documentation, and resources.
      </p>
      <div className="grid max-w-lg gap-3 sm:grid-cols-2">
        {questions.map((text) => (
          <SuggestionCard key={text} text={text} onSend={onSend} />
        ))}
      </div>
    </div>
  );
}

function SuggestionCard({ text, onSend }: { text: string; onSend?: (message: string) => void }) {
  return (
    <button
      onClick={() => onSend?.(text)}
      className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-700 shadow-sm transition-all hover:border-sandra-300 hover:bg-sandra-50 hover:shadow active:scale-[0.98]"
    >
      {text}
    </button>
  );
}
