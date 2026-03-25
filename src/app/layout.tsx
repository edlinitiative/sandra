import type { Metadata } from 'next';
import { Header } from '@/components/layout/header';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sandra — EdLight AI Assistant',
  description: 'Sandra is the AI assistant for the EdLight ecosystem. She supports Haitian Creole, French, and English.',
  icons: {
    icon: '/sandra-logo.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="flex h-full flex-col font-sans antialiased">
        <Header />
        <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      </body>
    </html>
  );
}
