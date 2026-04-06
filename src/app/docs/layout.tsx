import type { Metadata } from 'next';
import { DocsSidebar } from '@/components/docs/docs-sidebar';

export const metadata: Metadata = {
  title: 'Developer Docs — Sandra | EdLight',
  description: 'Integrate Sandra into your platform. Chat API, streaming, webhooks, voice, multi-tenant, and knowledge base guides.',
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <div className="hidden shrink-0 overflow-y-auto border-r border-white/[0.05] px-4 py-6 md:block md:w-60">
        <DocsSidebar />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-10 md:px-10">{children}</div>
      </div>
    </div>
  );
}
