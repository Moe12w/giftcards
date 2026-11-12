import type { Metadata } from 'next';
import Link from 'next/link';
import { site } from '@/lib/i18n/site';
import { pick } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: pick(site, locale).terms.title };
}

export default async function TermsPage() {
  const locale = await getLocale();
  const t = pick(site, locale).terms;

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
        <h2>{t.s1Title}</h2>
        <p>{t.s1Body}</p>

        <h2>{t.s2Title}</h2>
        <p>{t.s2Body}</p>

        <h2>{t.s3Title}</h2>
        <p>{t.s3Body}</p>

        <h2>{t.s4Title}</h2>
        <p>{t.s4Body}</p>

        <h2>{t.s5Title}</h2>
        <p>{t.s5Body}</p>

        <h2>{t.s6Title}</h2>
        <p>{t.s6Body}</p>

        <h2>{t.s7Title}</h2>
        <p>{t.s7Body}</p>

        <h2>{t.s8Title}</h2>
        <p>{t.s8Body}</p>

        <h2>{t.s9Title}</h2>
        <p>{t.s9Body}</p>

        <h2>{t.s10Title}</h2>
        <p>
          {t.s10BodyOne} <a href="mailto:hello@giftly.qa">hello@giftly.qa</a> {t.s10BodyTwo}{' '}
          <Link href="/contact">{t.contactForm}</Link>.
        </p>
      </section>
    </>
  );
}
