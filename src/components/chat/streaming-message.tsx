'use client';

interface StreamingMessageProps {
  content: string;
}

export function StreamingMessage({ content }: StreamingMessageProps) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sandra-500 to-sandra-700 text-xs font-bold text-white">
        S
      </div>
      <div className="max-w-[80%] items-start">
        <div className="rounded-2xl rounded-bl-md bg-gray-100 px-4 py-2.5 text-sm leading-relaxed text-gray-900">
          <span className="whitespace-pre-wrap">{content}</span>
          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-gray-500 align-middle" />
        </div>
      </div>
    </div>
  );
}
