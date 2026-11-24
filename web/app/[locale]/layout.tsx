import type { Metadata, Viewport } from 'next';
import '../globals.css';
import { I18nProvider } from '@/components/I18nProvider';
import { dirFor, type Locale } from '@/lib/i18n';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

// Only English and Arabic are valid public locales. Anything else is a 404
// rather than a page rendered with a nonsense `lang` attribute.
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'ar' }];
}

type PublicLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

/**
 * The public site's root layout. The locale comes from the URL, not from a
 * cookie, so every marketing page can be prerendered and served from the CDN.
 * Cookie-aware rewrites in next.config.ts map the neutral URLs to /en or /ar.
 */
export async function generateMetadata({ params }: PublicLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const isArabic = locale === 'ar';
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  return {
    metadataBase: new URL(base),
    alternates: {
      canonical: `/${locale}`,
      languages: { en: '/en', ar: '/ar' },
    },
    title: {
      default: isArabic
        ? 'Tazella — بطاقات هدايا وتجارب ومكافآت مؤسسية في قطر'
        : 'Tazella — Gift cards, experiences and corporate rewards in Qatar',
      template: '%s · Tazella',
    },
    description: isArabic
      ? 'Tazella هو سوق بطاقات الهدايا في قطر. أرسل بطاقة هدية، أو احجز تجربة، أو كافئ فريقاً بالكامل.'
      : 'Tazella is Qatar’s gift card marketplace. Send a gift card, book an experience, or reward a whole team — all in one place.',
    openGraph: {
      title: isArabic
        ? 'Tazella — اصنع هدية يحبّونها فعلاً'
        : 'Tazella — Give a gift they will actually use',
      description: isArabic
        ? 'بطاقات هدايا وتجارب ومكافآت مؤسسية من أفضل الأنشطة المستقلة في قطر.'
        : 'Gift cards, experiences and corporate rewards from the best independent businesses in Qatar.',
      type: 'website',
      locale: isArabic ? 'ar_QA' : 'en_US',
    },
  };
}

export default async function PublicLayout({ children, params }: PublicLayoutProps) {
  const { locale } = await params;
  const resolved: Locale = locale === 'ar' ? 'ar' : 'en';

  return (
    <html lang={resolved} dir={dirFor(resolved)}>
      <body>
        <I18nProvider locale={resolved}>{children}</I18nProvider>
      </body>
    </html>
  );
}
