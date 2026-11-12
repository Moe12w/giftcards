import type { Metadata, Viewport } from 'next';
import './globals.css';
import { I18nProvider } from '@/components/I18nProvider';
import { getLocale } from '@/lib/i18n/server';
import { dirFor } from '@/lib/i18n';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Lets the page reach under the notch and the Safari bar, so the sticky
  // headers can sit below them instead of hiding behind.
  viewportFit: 'cover',
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const isArabic = locale === 'ar';

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
    title: {
      default: isArabic
        ? 'غيفتلي — بطاقات هدايا وتجارب ومكافآت مؤسسية في قطر'
        : 'Giftly — Gift cards, experiences and corporate rewards in Qatar',
      template: '%s · Giftly',
    },
    description: isArabic
      ? 'غيفتلي هو سوق بطاقات الهدايا في قطر. أرسل بطاقة هدية، أو احجز تجربة، أو كافئ فريقاً بالكامل.'
      : 'Giftly is Qatar’s gift card marketplace. Send a gift card, book an experience, or reward a whole team — all in one place.',
    openGraph: {
      title: isArabic
        ? 'غيفتلي — اصنع هدية يحبّونها فعلاً'
        : 'Giftly — Give a gift they will actually use',
      description: isArabic
        ? 'بطاقات هدايا وتجارب ومكافآت مؤسسية من أفضل الأنشطة المستقلة في قطر.'
        : 'Gift cards, experiences and corporate rewards from the best independent businesses in Qatar.',
      type: 'website',
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The cookie decides the language, so the whole tree renders in one go.
  const locale = await getLocale();

  return (
    <html lang={locale} dir={dirFor(locale)}>
      <body>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
