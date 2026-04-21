import { ChatHeader } from '@/components/chat/chat-header';

/**
 * /chat has its own mobile header (slim, chat-specific).
 * The site-wide Header is still rendered by root layout on sm+.
 */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ChatHeader />
      {children}
    </>
  );
}
