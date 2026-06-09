import './globals.css';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata = {
  title: 'TradeZella Canvas',
  description: 'Liquidity Sweep playback & visualization system.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className={cn(inter.className, 'font-sans antialiased')}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
