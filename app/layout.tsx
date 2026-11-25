import type { Metadata, Viewport } from 'next';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Onde está o Felipe? — Radar da Escala',
  description:
    'Acompanhe em tempo real onde o Felipe está voando, pernoitando ou de folga, com rastreamento ao vivo via OpenSky Network.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Onde está o Felipe?',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="font-sans min-h-screen antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
