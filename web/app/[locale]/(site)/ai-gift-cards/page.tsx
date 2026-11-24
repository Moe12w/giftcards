import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Building2,
  CalendarHeart,
  Check,
  Gift,
  Globe2,
  Languages,
  MessageCircle,
  Plug,
  Search,
  ShieldCheck,
  Store,
  Wallet,
} from 'lucide-react';
import { aiGiftCards } from '@/lib/i18n/ai';
import { pick } from '@/lib/i18n';
import { getPublicLocale } from '@/lib/i18n/server';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://giftly.qa').replace(
  /\/$/,
  '',
);

function pageUrl(locale: string) {
  return `${SITE_URL}/${locale}/ai-gift-cards`;
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getPublicLocale();
  const t = pick(aiGiftCards, locale);
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
      siteName: 'Tazilla',
      locale: locale === 'ar' ? 'ar_QA' : 'en_QA',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t.meta.ogTitle,
      description: t.meta.ogDescription,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
  };
}

export default async function AiGiftCardsPage() {
  const locale = await getPublicLocale();
  const t = pick(aiGiftCards, locale);
  const isArabic = locale === 'ar';
  const canonical = pageUrl(locale);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Tazilla',
      url: SITE_URL,
      description: isArabic
        ? 'سوق بطاقات الهدايا والتجارب والمكافآت المؤسسية في قطر.'
        : 'A gift card, experience and corporate rewards marketplace in Qatar.',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Doha',
        addressCountry: 'QA',
      },
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'hello@giftly.qa',
        areaServed: 'QA',
        availableLanguage: ['en', 'ar'],
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: t.meta.title,
      description: t.meta.description,
      url: canonical,
      inLanguage: isArabic ? 'ar-QA' : 'en-QA',
      isPartOf: {
        '@type': 'WebSite',
        name: 'Tazilla',
        url: SITE_URL,
      },
      about: {
        '@type': 'Service',
        name: isArabic
          ? 'تسوّق بطاقات الهدايا بالذكاء الاصطناعي'
          : 'AI gift card shopping',
        serviceType: isArabic
          ? 'اكتشاف بطاقات الهدايا وتجهيز الطلبات عبر مساعدات الذكاء الاصطناعي'
          : 'Gift card discovery and order preparation through AI assistants',
        areaServed: 'Qatar',
        provider: {
          '@type': 'Organization',
          name: 'Tazilla',
          url: SITE_URL,
        },
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
          name: isArabic ? 'بطاقات الهدايا بالذكاء الاصطناعي' : 'AI gift cards',
          item: canonical,
        },
      ],
    },
  ];

  const benefitIcons = [MessageCircle, Store, Search, Gift];
  const stepIcons = [Bot, Store, Search, ShieldCheck];

  return (
    <>
      <script
        type="application/ld+json"
        // JSON.stringify does not escape '<', so an env-derived URL containing
        // </script> could break out of the script element under a CSP that
        // allows inline scripts. Escape the HTML-significant characters.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd)
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
            .replace(/&/g, '\\u0026'),
        }}
      />

      <section className="page-hero ai-hero">
        <div className="container">
          <div className="grid-2">
            <div>
              <span className="eyebrow mint">{t.hero.eyebrow}</span>
              <h1>
                {t.hero.titleLine1}
                <br />
                <span className="ai-highlight">{t.hero.titleLine2}</span>
              </h1>
              <p className="lede">{t.hero.lede}</p>
              <div className="btn-row" style={{ marginTop: 26 }}>
                <Link className="btn primary lg" href="/vendors">
                  {t.hero.primaryCta} <ArrowRight size={18} />
                </Link>
                <Link className="btn lg" href="#how-it-works">
                  {t.hero.secondaryCta}
                </Link>
              </div>
              <div className="hero-trust" style={{ marginTop: 24 }}>
                <span>
                  <Store size={16} /> {t.hero.trustLocal}
                </span>
                <span>
                  <Plug size={16} /> {t.hero.trustMcp}
                </span>
                <span>
                  <ShieldCheck size={16} /> {t.hero.trustSecure}
                </span>
              </div>
            </div>

            <div className="ai-chat card">
              <div className="ai-chat-top">
                <span className="ai-chat-avatar">
                  <Bot size={20} />
                </span>
                <div>
                  <strong>{t.hero.chatLabel}</strong>
                  <span className="small muted">{t.hero.status}</span>
                </div>
                <span className="tag lavender">{t.hero.chatNote}</span>
              </div>
              <div className="ai-chat-body">
                <p className="ai-chat-bubble user">{t.hero.chatUser}</p>
                <p className="ai-chat-bubble assistant">{t.hero.chatAssistant}</p>
                <div className="ai-chat-result">
                  <Check size={16} /> {t.hero.chatResult}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container section" id="how-it-works">
        <div className="section-head">
          <div className="copy">
            <span className="eyebrow lavender">{t.how.eyebrow}</span>
            <h2>{t.how.title}</h2>
            <p className="lede">{t.how.body}</p>
          </div>
        </div>

        <div className="grid-4">
          {t.how.steps.map((step, index) => {
            const Icon = stepIcons[index] ?? Gift;
            return (
              <article className="card step-card ai-step" key={step.title}>
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

        <div className="callout info" style={{ marginTop: 22 }}>
          <ShieldCheck size={16} /> {t.how.note}
        </div>
      </section>

      <section className="container section tight">
        <div className="section-head">
          <div className="copy">
            <span className="eyebrow coral">{t.why.eyebrow}</span>
            <h2>{t.why.title}</h2>
            <p className="lede">{t.why.body}</p>
          </div>
        </div>

        <div className="grid-2">
          {t.why.benefits.map((benefit, index) => {
            const Icon = benefitIcons[index] ?? Gift;
            return (
              <article className="card ai-benefit" key={benefit.title}>
                <span className={`icon-tile ${index % 2 === 0 ? '' : 'lavender'}`}>
                  <Icon size={22} />
                </span>
                <div>
                  <h3>{benefit.title}</h3>
                  <p className="small" style={{ marginTop: 6 }}>
                    {benefit.body}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <div className="copy">
            <span className="eyebrow mint">{t.platforms.eyebrow}</span>
            <h2>{t.platforms.title}</h2>
            <p className="lede">{t.platforms.body}</p>
          </div>
        </div>

        <div className="grid-3">
          {t.platforms.platforms.map((platform) => (
            <article className="card ai-platform" key={platform.name}>
              <span className="icon-tile lavender">
                {platform.name === 'ChatGPT' || platform.name === 'Claude' ? (
                  <Bot size={22} />
                ) : (
                  <Plug size={22} />
                )}
              </span>
              <h3>{platform.name}</h3>
              <p className="small">{platform.body}</p>
              <span
                className={`tag ${
                  platform.status.includes('available') || platform.status.includes('متاح')
                    ? 'success'
                    : 'warning'
                }`}
              >
                {platform.status}
              </span>
            </article>
          ))}
        </div>

        <div className="callout warn" style={{ marginTop: 22 }}>
          <BadgeCheck size={16} /> {t.platforms.disclaimer}
        </div>
      </section>

      <section className="container section tight">
        <div className="ai-business card">
          <div>
            <span className="eyebrow gold">{t.forBusiness.eyebrow}</span>
            <h2>{t.forBusiness.title}</h2>
            <p className="lede" style={{ marginTop: 12 }}>
              {t.forBusiness.body}
            </p>
            <div className="btn-row" style={{ marginTop: 22 }}>
              <Link className="btn primary" href="/contact">
                {t.forBusiness.cta} <ArrowRight size={16} />
              </Link>
              <Link className="btn" href="/corporate">
                {t.forBusiness.secondary}
              </Link>
            </div>
          </div>
          <ul className="check-list">
            {t.forBusiness.bullets.map((bullet) => (
              <li key={bullet}>
                <Check size={16} /> {bullet}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container section" id="connect">
        <div className="ai-mcp card">
          <div className="section-head" style={{ marginBottom: 0 }}>
            <div className="copy">
              <span className="eyebrow lavender">{t.mcp.eyebrow}</span>
              <h2>{t.mcp.title}</h2>
              <p className="lede">{t.mcp.body}</p>
            </div>
          </div>

          <div className="callout info">
            <ShieldCheck size={16} /> {t.mcp.note}
          </div>

          {/* The endpoint comes from NEXT_PUBLIC_SUPABASE_URL. Hide the
              connection details rather than printing an empty URL if a build
              was made without it. */}
          {t.mcp.endpoint ? (
          <details className="ai-connect">
            <summary>{t.mcp.docsCta}</summary>
            <div className="ai-connect-body">
              <div>
                <span className="small muted" style={{ fontWeight: 800 }}>
                  {t.mcp.endpointLabel}
                </span>
                <div className="ai-endpoint">
                  <Globe2 size={16} />
                  <code>{t.mcp.endpoint}</code>
                </div>
              </div>

              <div>
                <span className="small muted" style={{ fontWeight: 800 }}>
                  {t.mcp.toolsLabel}
                </span>
                <div className="ai-tool-list" style={{ marginTop: 10 }}>
                  {t.mcp.tools.map((tool) => (
                    <code key={tool}>{tool}</code>
                  ))}
                </div>
              </div>

              <pre>{`{
  "mcpServers": {
    "giftly": {
      "type": "http",
      "url": "${t.mcp.endpoint}"
    }
  }
}`}</pre>
              <p className="small muted">
                {isArabic
                  ? 'أضف ترويسة Authorization: Bearer <رمز دخول العميل> عند استخدام أدوات الطلب.'
                  : 'Add an Authorization: Bearer <customer access token> header when using the order tools.'}
              </p>
            </div>
          </details>
          ) : null}
        </div>
      </section>

      <section className="container section tight">
        <div className="section-head">
          <div className="copy">
            <span className="eyebrow coral">{t.faq.eyebrow}</span>
            <h2>{t.faq.title}</h2>
          </div>
        </div>

        <div className="faq-list ai-faq">
          {t.faq.items.map((item) => (
            <details className="faq-item" key={item.q}>
              <summary>{item.q}</summary>
              <div className="answer">{item.a}</div>
            </details>
          ))}
        </div>
      </section>

      <section className="container section tight">
        <div className="card" style={{ display: 'grid', gap: 18 }}>
          <div className="section-head" style={{ marginBottom: 0 }}>
            <div className="copy">
              <span className="eyebrow mint">{t.related.title}</span>
              <h2 style={{ fontSize: '1.8rem' }}>
                {isArabic ? 'من الاكتشاف إلى الاستخدام.' : 'From discovery to redemption.'}
              </h2>
            </div>
          </div>
          <div className="ai-related">
            {t.related.links.map((link) => (
              <Link href={link.href} key={link.href}>
                {link.label} <ArrowRight size={15} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="cta-band">
          <span className="eyebrow">{t.cta.eyebrow}</span>
          <h2>{t.cta.title}</h2>
          <p>{t.cta.body}</p>
          <div className="btn-row">
            <Link className="btn gold lg" href="/vendors">
              {t.cta.primary} <ArrowRight size={18} />
            </Link>
            <Link className="btn ghost lg" href="/download" style={{ color: '#fff' }}>
              {t.cta.secondary}
            </Link>
          </div>
        </div>
      </section>

      <section className="container section tight">
        <div className="grid-4">
          {[
            { icon: CalendarHeart, label: isArabic ? 'تجارب وباقات' : 'Experiences & packages' },
            { icon: Wallet, label: isArabic ? 'محفظة رقمية' : 'Digital wallet' },
            { icon: Languages, label: isArabic ? 'عربي وإنجليزي' : 'Arabic & English' },
            { icon: Building2, label: isArabic ? 'هدايا للشركات' : 'Corporate gifting' },
          ].map(({ icon: Icon, label }) => (
            <div className="card" key={label} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span className="icon-tile" style={{ width: 42, height: 42 }}>
                <Icon size={19} />
              </span>
              <strong className="small">{label}</strong>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
