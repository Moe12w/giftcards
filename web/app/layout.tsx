import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Giftly — Gift cards, experiences and corporate rewards in Qatar',
    template: '%s · Giftly',
  },
  description:
    'Giftly is Qatar’s gift card marketplace. Send a gift card, book an experience, or reward a whole team — all in one place.',
  openGraph: {
    title: 'Giftly — Give a gift they will actually use',
    description:
      'Gift cards, experiences and corporate rewards from the best independent businesses in Qatar.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
