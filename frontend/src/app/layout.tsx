import type { Metadata } from 'next';
import { Inter, Newsreader } from 'next/font/google';

import './globals.css';

import { cn } from '@/lib/utils';
import { Providers } from './providers';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'], display: 'swap' });
const newsreader = Newsreader({
  variable: '--font-newsreader',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: { default: 'Nexo Assist', template: '%s · Nexo Assist' },
  description: 'Service desk de TI da Nexo: seu problema de TI, resolvido em uma conversa.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={cn('h-full antialiased', inter.variable, newsreader.variable)}>
      <body className="min-h-dvh font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
