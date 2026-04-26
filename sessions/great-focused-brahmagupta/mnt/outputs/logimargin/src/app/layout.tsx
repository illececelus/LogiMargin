import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'LogiMargin — Smart Freight Intelligence',
  description: 'Financial intelligence and smart factoring for Texas owner-operators.',
};

export const viewport: Viewport = {
  themeColor: '#0A0D14',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
