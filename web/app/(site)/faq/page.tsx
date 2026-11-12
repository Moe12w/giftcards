import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { site } from '@/lib/i18n/site';
import { pick } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: pick(site, locale).nav.howItWorks };
}

export default async function FaqPage() {
  const locale = await getLocale();
  const t = pick(site, locale).faq;

  return (
    <>
      <section className="page-hero">
        <div className="container narrow">
          <span className="eyebrow mint">{t.eyebrow}</span>
          <h1>{t.title}</h1>
          <p className="lede">{t.lede}</p>
        </div>
      </section>

      <section className="container narrow section tight">
        <div className="faq-sections">
          {t.sections.map((section) => (
            <div key={section.title}>
              <h2 className="faq-heading">{section.title}</h2>
              <div className="faq-list">
                {section.items.map((item) => (
                  <details className="faq-item" key={item.q}>
                    <summary>{item.q}</summary>
                    <div className="answer">{item.a}</div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="card mint" style={{ marginTop: 48 }}>
          <span className="icon-tile ink">
            <MessageCircle size={22} />
          </span>
          <h2 style={{ fontSize: '1.7rem', marginTop: 14 }}>{t.stillStuck}</h2>
          <p style={{ marginTop: 8 }}>{t.stillStuckBody}</p>
          <div className="btn-row" style={{ marginTop: 18 }}>
            <Link className="btn primary" href="/contact">
              {t.contactSupport} <ArrowRight size={16} />
            </Link>
            <Link className="btn" href="/vendors">
              {t.browseVendors}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
