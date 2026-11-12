import type { Metadata } from 'next';
import Link from 'next/link';
import { site } from '@/lib/i18n/site';
import { pick } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: pick(site, locale).privacy.title };
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  const t = pick(site, locale).privacy;

  return (
    <>
      <section className="page-hero">
        <div className="container narrow">
          <span className="eyebrow">{t.eyebrow}</span>
          <h1>{t.title}</h1>
          <p className="lede">{t.lastUpdated}</p>
        </div>
      </section>
      <section className="container narrow section tight legal-copy">
        <h2>{t.collectTitle}</h2>
        <p>{t.collectBody}</p>

        <h2>{t.useTitle}</h2>
        <p>{t.useBody}</p>

        <h2>{t.whoTitle}</h2>
        <p>{t.whoBody}</p>

        <h2>{t.paymentsTitle}</h2>
        <p>{t.paymentsBody}</p>

        <h2>{t.storageTitle}</h2>
        <p>{t.storageBody}</p>

        <h2>{t.retentionTitle}</h2>
        <p>{t.retentionBody}</p>

        <h2>{t.choicesTitle}</h2>
        <p>
          {t.choicesBodyOne} <a href="mailto:privacy@giftly.qa">privacy@giftly.qa</a>{' '}
          {t.choicesBodyTwo}
        </p>

        <h2>{t.cookiesTitle}</h2>
        <p>{t.cookiesBody}</p>

        <h2>{t.contactTitle}</h2>
        <p>
          {t.contactBodyBefore} <Link href="/contact">{t.contactLink}</Link>.
        </p>
      </section>
    </>
  );
}
