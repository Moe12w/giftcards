import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { Mail, Send, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { submitDeletionRequest } from '@/lib/actions/public';
import { SearchNotice } from '@/components/SearchNotice';
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
 * same page to be reachable without the app.
 *
 * The form writes to `support_requests` with kind `account_deletion` (0160) and
 * works signed out, so a reviewer or a user who has lost access can use it.
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

          <div className="card mint" id="request">
            <span className="icon-tile ink">
              <Mail size={22} />
            </span>
            <h3 style={{ marginTop: 14 }}>{t.requestTitle}</h3>
            <p className="small" style={{ marginTop: 6 }}>
              {t.requestBody}
            </p>
            <Suspense fallback={null}>
              <SearchNotice successMessage={t.formSuccess} />
            </Suspense>
            <form action={submitDeletionRequest} className="form" style={{ marginTop: 12 }}>
              <div className="form-grid">
                <div className="field full">
                  <label htmlFor="deletion-email">{t.formEmailLabel}</label>
                  <input
                    id="deletion-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder={t.formEmailPlaceholder}
                  />
                </div>
                <div className="field full">
                  <label htmlFor="deletion-note">{t.formNoteLabel}</label>
                  <textarea id="deletion-note" name="note" placeholder={t.formNotePlaceholder} />
                </div>
              </div>
              <button className="btn primary block" type="submit">
                {t.formSubmit} <Send size={16} />
              </button>
              <p className="small muted" style={{ marginTop: 8 }}>
                {t.formPrivacy}{' '}
                <Link href="/privacy" style={{ fontWeight: 800 }}>
                  {t.privacyLink}
                </Link>
                .
              </p>
            </form>
            <p className="small" style={{ marginTop: 10 }}>
              {t.formOrEmail}{' '}
              <a href={requestHref} style={{ fontWeight: 800 }}>
                {t.requestEmail}
              </a>
              .
            </p>
            <p className="small muted" style={{ marginTop: 6 }}>
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
          {t.helpAfter}
        </p>
      </section>
    </>
  );
}
