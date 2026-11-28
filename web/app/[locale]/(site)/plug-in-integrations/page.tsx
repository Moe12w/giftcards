import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Download,
  Gift,
  Globe2,
  KeyRound,
  Layers3,
  PackageCheck,
  Plug,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  Store,
  Wallet,
} from 'lucide-react';
import { integrationsCopy } from '@/lib/i18n/integrations';
import { fill, pick } from '@/lib/i18n';
import { getPublicLocale } from '@/lib/i18n/server';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tazella.com.qa').replace(
  /\/$/,
  '',
);

/** Kept in step with packages/wordpress/tazella-gift-cards/composer.json. */
const PLUGIN_VERSION = '0.2.0';
const PLUGIN_DOWNLOAD = '/downloads/tazella-gift-cards.zip';

function pageUrl(locale: string) {
  return `${SITE_URL}/${locale}/plug-in-integrations`;
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getPublicLocale();
  const t = pick(integrationsCopy, locale);
  const canonical = pageUrl(locale);

  return {
    metadataBase: new URL(SITE_URL),
    title: { absolute: t.meta.title },
    description: t.meta.description,
    alternates: {
      canonical,
      languages: { en: pageUrl('en'), ar: pageUrl('ar') },
    },
    openGraph: {
      title: t.meta.ogTitle,
      description: t.meta.ogDescription,
      url: canonical,
      siteName: 'Tazella',
      locale: locale === 'ar' ? 'ar_QA' : 'en_QA',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t.meta.ogTitle,
      description: t.meta.ogDescription,
    },
    robots: { index: true, follow: true },
  };
}

export default async function PlugInIntegrationsPage() {
  const locale = await getPublicLocale();
  const t = pick(integrationsCopy, locale);
  const isArabic = locale === 'ar';
  const canonical = pageUrl(locale);

  const valueIcons = [Wallet, Globe2, Store, ReceiptText];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: t.meta.title,
      description: t.meta.description,
      url: canonical,
      inLanguage: isArabic ? 'ar-QA' : 'en-QA',
      isPartOf: { '@type': 'WebSite', name: 'Tazella', url: SITE_URL },
      about: {
        '@type': 'Service',
        name: isArabic ? 'ربط بطاقات الهدايا بالمنصات' : 'Gift-card platform integrations',
        serviceType: isArabic
          ? 'وسيلة دفع ببطاقات الهدايا داخل منصات خارجية'
          : 'Gift-card payment acceptance inside external platforms',
        areaServed: 'Qatar',
        provider: { '@type': 'Organization', name: 'Tazella', url: SITE_URL },
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: isArabic ? 'الرئيسية' : 'Home',
          item: SITE_URL,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: t.hero.title,
          item: canonical,
        },
      ],
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd)
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
            .replace(/&/g, '\\u0026'),
        }}
      />

      <section className="page-hero">
        <div className="container">
          <div className="hero-copy" style={{ maxWidth: 860 }}>
            <span className="eyebrow mint">{t.hero.eyebrow}</span>
            <h1>{t.hero.title}</h1>
            <p className="lede">{t.hero.lede}</p>
            <div className="btn-row">
              <Link className="btn primary lg" href="/contact">
                {t.hero.primaryCta} <ArrowRight size={18} />
              </Link>
              <Link className="btn lg" href="#how-it-works">
                {t.hero.secondaryCta}
              </Link>
            </div>
            <div className="hero-trust" style={{ marginTop: 24 }}>
              <span>
                <Layers3 size={16} /> {t.hero.trustOne}
              </span>
              <span>
                <ShieldCheck size={16} /> {t.hero.trustTwo}
              </span>
              <span>
                <Plug size={16} /> {t.hero.trustThree}
              </span>
            </div>
            <p className="small" style={{ marginTop: 22, maxWidth: 720 }}>
              {t.hero.statusNote}
            </p>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <div className="copy">
            <span className="eyebrow coral">{t.value.eyebrow}</span>
            <h2>{t.value.title}</h2>
            <p className="lede">{t.value.body}</p>
          </div>
        </div>
        <div className="grid-4">
          {t.value.cards.map((card, index) => {
            const Icon = valueIcons[index] ?? Gift;
            return (
              <article className="card step-card" key={card.title}>
                <span className="icon-tile">
                  <Icon size={22} />
                </span>
                <h3 style={{ marginTop: 14 }}>{card.title}</h3>
                <p className="small" style={{ marginTop: 8 }}>
                  {card.body}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="container section" id="how-it-works">
        <div className="section-head">
          <div className="copy">
            <span className="eyebrow lavender">{t.flow.eyebrow}</span>
            <h2>{t.flow.title}</h2>
            <p className="lede">{t.flow.body}</p>
          </div>
        </div>
        <div className="timeline-card">
          {t.flow.steps.map((step, index) => (
            <div className="timeline-item" key={step.title}>
              <span className="timeline-dot" />
              <div>
                <strong>
                  {index + 1}. {step.title}
                </strong>
                <span>{step.body}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="callout info" style={{ marginTop: 22 }}>
          <ShieldCheck size={16} /> {t.flow.note}
        </div>
      </section>

      <section className="container section tight">
        <div className="section-head">
          <div className="copy">
            <span className="eyebrow gold">{t.platforms.eyebrow}</span>
            <h2>{t.platforms.title}</h2>
            <p className="lede">{t.platforms.body}</p>
          </div>
        </div>
        <div className="grid-4">
          {t.platforms.items.map((platform) => (
            <article className="card" key={platform.name}>
              <span className="icon-tile lavender">
                <Store size={22} />
              </span>
              <h3 style={{ marginTop: 14 }}>{platform.name}</h3>
              <p className="small" style={{ marginTop: 8 }}>
                {platform.body}
              </p>
              <span
                className={`tag ${
                  platform.status === 'wordpress'
                    ? 'success'
                    : platform.status === 'review'
                      ? 'warning'
                      : ''
                }`}
              >
                {platform.status === 'review'
                  ? t.platforms.statusReview
                  : platform.status === 'wordpress'
                    ? t.platforms.statusWordpress
                    : t.platforms.statusInternal}
              </span>
            </article>
          ))}
        </div>
        <div className="callout warn" style={{ marginTop: 22 }}>
          <BadgeCheck size={16} /> {t.platforms.disclaimer}
        </div>
      </section>

      <section className="container section tight" id="wordpress">
        <div className="section-head">
          <div className="copy">
            <span className="eyebrow coral">{t.wordpress.eyebrow}</span>
            <h2>{t.wordpress.title}</h2>
            <p className="lede">{t.wordpress.body}</p>
          </div>
        </div>
        <div className="ai-mcp card" style={{ marginBottom: 22 }}>
          <div className="grid-2" style={{ alignItems: 'start' }}>
            <div>
              <span className="icon-tile mint">
                <PackageCheck size={22} />
              </span>
              <h3 style={{ marginTop: 12 }}>{t.wordpress.downloadTitle}</h3>
              <p className="small" style={{ marginTop: 8 }}>
                {fill(t.wordpress.downloadBody, { version: PLUGIN_VERSION })}
              </p>
              <a className="btn primary" href={PLUGIN_DOWNLOAD} download style={{ marginTop: 14 }}>
                <Download size={16} /> {t.wordpress.downloadCta}
              </a>
              <p className="small muted" style={{ marginTop: 10 }}>
                {t.wordpress.downloadNote}
              </p>
              <p className="small muted" style={{ marginTop: 10 }}>
                <code>tazella-gift-cards.zip</code> · v{PLUGIN_VERSION}
              </p>
            </div>
            <div>
              <h3>{t.wordpress.requirementsTitle}</h3>
              <ul className="check-list">
                {t.wordpress.requirements.map((requirement) => (
                  <li key={requirement}>
                    <Check size={16} /> {requirement}
                  </li>
                ))}
              </ul>
              <div className="callout info" style={{ marginTop: 18 }}>
                <KeyRound size={16} />{' '}
                <Link href="/vendor/settings#integrations" style={{ textDecoration: 'underline' }}>
                  {t.wordpress.keysCta}
                </Link>
              </div>
            </div>
          </div>

          <div>
            <h3 style={{ marginBottom: 12 }}>{t.wordpress.installTitle}</h3>
            <div className="timeline-card">
              {t.wordpress.installSteps.map((step, index) => (
                <div className="timeline-item" key={step}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>
                      {index + 1}. {step}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid-3">
          {t.wordpress.steps.map((step, index) => {
            const Icon = [KeyRound, Plug, Wallet][index] ?? Gift;
            return (
              <article className="card step-card" key={step.title}>
                <div className="btn-row" style={{ justifyContent: 'space-between' }}>
                  <span className="step-number">{index + 1}</span>
                  <Icon size={22} />
                </div>
                <h3>{step.title}</h3>
                <p className="small">{step.body}</p>
              </article>
            );
          })}
        </div>
        <div className="callout warn" style={{ marginTop: 22 }}>
          <ShieldCheck size={16} /> {t.wordpress.note}
        </div>
      </section>

      <section className="container section" id="api">
        <div className="ai-mcp card">
          <div className="section-head">
            <div className="copy">
              <span className="eyebrow mint">{t.api.eyebrow}</span>
              <h2>{t.api.title}</h2>
              <p className="lede">{t.api.body}</p>
            </div>
          </div>

          <div className="grid-2" style={{ alignItems: 'start' }}>
            <div>
              <h3 style={{ marginBottom: 12 }}>{t.api.headersTitle}</h3>
              <div className="split-list">
                {t.api.headers.map((header) => (
                  <div key={header.name}>
                    <span className="k">
                      <code>{header.name}</code>
                    </span>
                    <span className="v">{header.body}</span>
                  </div>
                ))}
              </div>
              <p className="small muted" style={{ marginTop: 10 }}>
                {t.api.headersNote}
              </p>
              <div className="callout info" style={{ marginTop: 18 }}>
                <KeyRound size={16} /> {t.api.note}
              </div>
            </div>
            <div>
              <h3 style={{ marginBottom: 12 }}>{t.api.endpointsTitle}</h3>
              <div className="split-list">
                {t.api.endpoints.map((endpoint) => (
                  <div key={`${endpoint.method}-${endpoint.path}`}>
                    <span className="k">
                      <code>
                        {endpoint.method} {endpoint.path}
                      </code>
                    </span>
                    <span className="v">{endpoint.body}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="callout" style={{ marginTop: 22 }}>
            <RefreshCcw size={16} /> {t.api.idempotency}
          </div>
          <div className="callout" style={{ marginTop: 12 }}>
            <Globe2 size={16} /> {t.api.environments}
          </div>
        </div>
      </section>

      <section className="container section tight">
        <div className="card ink">
          <div className="section-head">
            <div className="copy">
              <span className="eyebrow gold">{t.trust.eyebrow}</span>
              <h2 style={{ color: '#fff' }}>{t.trust.title}</h2>
              <p className="lede">{t.trust.body}</p>
            </div>
          </div>
          <ul className="check-list">
            {t.trust.bullets.map((bullet) => (
              <li key={bullet}>
                <Check size={16} /> {bullet}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container section tight">
        <div className="section-head">
          <div className="copy">
            <span className="eyebrow coral">{t.faq.eyebrow}</span>
            <h2>{t.faq.title}</h2>
          </div>
        </div>
        <div className="faq-list">
          {t.faq.items.map((item) => (
            <details className="faq-item" key={item.q}>
              <summary>{item.q}</summary>
              <div className="answer">{item.a}</div>
            </details>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="cta-band">
          <span className="eyebrow gold">
            <Plug size={14} /> {t.cta.eyebrow}
          </span>
          <h2>{t.cta.title}</h2>
          <p>{t.cta.body}</p>
          <div className="btn-row">
            <Link className="btn primary" href="/contact">
              {t.cta.primary} <ArrowRight size={16} />
            </Link>
            <Link className="btn ghost" href="/vendor/register" style={{ color: '#fff' }}>
              {t.cta.secondary}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
