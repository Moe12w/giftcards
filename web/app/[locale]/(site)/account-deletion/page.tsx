import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { site } from '@/lib/i18n/site';
import { pick } from '@/lib/i18n';
import { getPublicLocale } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getPublicLocale();
  return { title: pick(site, locale).accountDeletion.title };
}

/**
 * Public account deletion resource.
 *
 * Google Play's User Data policy requires apps with accounts to offer deletion
 * inside the app *and* a public web page where users can request it; the URL of
 * this page goes in the Play Console account deletion field. Apple expects the
 * same page to be reachable without the app. Everything here is static copy, so
 * it renders for a signed-out reviewer in either language.
 */
export default async function AccountDeletionPage() {
  const locale = await getPublicLocale();
  const t = pick(site, locale).accountDeletion;
  const requestHref = `mailto:${t.requestEmail}?subject=${encodeURIComponent(t.requestSubject)}`;

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow coral">{t.eyebrow}</span>
          <h1>{t.title}</h1>
          <p className="lede">{t.lede}</p>
        </div>
      </section>

      <section className="container section tight">
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <div className="card">
            <span className="icon-tile">
              <Smartphone size={22} />
            </span>
            <h3 style={{ marginTop: 14 }}>{t.inAppTitle}</h3>
            <ol
              className="small"
              style={{ marginTop: 10, paddingInlineStart: 20, display: 'grid', gap: 8 }}
            >
              <li>{t.inAppStep1}</li>
              <li>{t.inAppStep2}</li>
              <li>{t.inAppStep3}</li>
            </ol>
          </div>

          <div className="card mint">
            <span className="icon-tile ink">
              <Mail size={22} />
            </span>
            <h3 style={{ marginTop: 14 }}>{t.requestTitle}</h3>
            <p className="small" style={{ marginTop: 6 }}>
              {t.requestBody}
            </p>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <a className="btn primary" href={requestHref}>
                {t.requestEmail}
              </a>
            </div>
            <p className="small muted" style={{ marginTop: 10 }}>
              {t.requestTime}
            </p>
          </div>
        </div>
      </section>

      <section className="container section tight">
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <div className="card">
            <span className="icon-tile coral">
              <Trash2 size={22} />
            </span>
            <h3 style={{ marginTop: 14 }}>{t.deletedTitle}</h3>
            <p className="small" style={{ marginTop: 6 }}>
              {t.deletedBody}
            </p>
          </div>
          <div className="card">
            <span className="icon-tile gold">
              <ShieldCheck size={22} />
            </span>
            <h3 style={{ marginTop: 14 }}>{t.keptTitle}</h3>
            <p className="small" style={{ marginTop: 6 }}>
              {t.keptBody}
            </p>
          </div>
        </div>

        <div className="callout info" style={{ marginTop: 18 }}>
          <strong>{t.businessTitle}.</strong> {t.businessBody}
        </div>
      </section>

      <section className="container section tight">
        <p className="small muted">
          <strong>{t.helpTitle}</strong> {t.helpBody}{' '}
          <a href={requestHref} style={{ fontWeight: 800 }}>
            {t.requestEmail}
          </a>{' '}
          {t.helpAfter}{' '}
          <Link href="/privacy" style={{ fontWeight: 800 }}>
            {t.privacyLink}
          </Link>
          .
        </p>
      </section>
    </>
  );
}
