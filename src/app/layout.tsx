import type { Metadata, Viewport } from 'next';
import { SessionProvider } from 'next-auth/react';
import { Header } from '@/components/layout/header';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

export const metadata: Metadata = {
  title: 'Sandra — EdLight AI Assistant',
  description: 'Sandra is the AI assistant for the EdLight ecosystem. She supports Haitian Creole, French, and English.',
  icons: {
    icon: '/sandra-logo.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-dvh">
      <body className="flex h-full flex-col overflow-hidden font-sans antialiased">
        <SessionProvider>
          <Header />
          <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
