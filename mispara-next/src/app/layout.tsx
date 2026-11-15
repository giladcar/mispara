import type { Metadata, Viewport } from 'next';
import { Heebo } from 'next/font/google';
import './globals.css';

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['300', '400', '500', '700', '900'],
});

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'המספרה - קביעת תורים',
  description: 'מערכת חכמה לקביעת תורים במספרה בקליק',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'המספרה',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.className} bg-zinc-950 text-zinc-100 antialiased`}>
        {children}
      </body>
    </html>
  );
}