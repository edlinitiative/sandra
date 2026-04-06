import type { Metadata, Viewport } from 'next';
import { SessionProvider } from 'next-auth/react';
import { Header } from '@/components/layout/header';
import { APP_NAME } from '@/lib/config/constants';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

export const metadata: Metadata = {
  title: `${APP_NAME} — AI Assistant`,
  description: `${APP_NAME} is an AI assistant platform with multi-channel support.`,
  icons: {
    icon: '/sandra-logo.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-dvh">
      <body className="flex h-full flex-col overflow-hidden bg-surface font-sans text-on-surface antialiased selection:bg-primary-container selection:text-on-primary-container">
        <SessionProvider>
          <Header />
          <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
