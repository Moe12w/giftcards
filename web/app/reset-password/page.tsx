import type { Metadata } from 'next';
import Link from 'next/link';
import { updatePassword } from '@/lib/actions/auth';
import { Logo } from '@/components/Logo';
import { pick } from '@/lib/i18n';
import { componentsCopy } from '@/lib/i18n/components';
import { getLocale } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: pick(componentsCopy, locale).resetPassword.title };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const t = pick(componentsCopy, locale).resetPassword;
  const done = params.done === '1';
  const error = params.error === 'link' ? t.invalidLink : null;

  return (
    <div className="auth-shell">
      <div className="auth-side lavender">
        <Logo />
        <div>
          <h2>{t.heading}</h2>
          <p>{t.body}</p>
        </div>
        <p className="small">{t.footer}</p>
      </div>
      <div className="auth-main">
        <div className="auth-card">
          <span className="eyebrow lavender">{t.eyebrow}</span>
          <h1 style={{ marginTop: 14 }}>{done ? t.doneTitle : t.newTitle}</h1>
          {done ? (
            <>
              <p style={{ marginTop: 12 }}>{t.doneBody}</p>
              <div className="form">
                <Link className="btn primary block" href="/vendor">
                  {t.vendorDashboard}
                </Link>
                <Link className="btn block" href="/enterprise">
                  {t.enterpriseDashboard}
                </Link>
                <Link className="btn block" href="/admin">
                  {t.adminDashboard}
                </Link>
              </div>
            </>
          ) : (
            <>
              <p style={{ marginTop: 12 }}>{t.pickNew}</p>
              {error ? <div className="callout error" style={{ marginTop: 16 }}>{error}</div> : null}
              {params.error && !error ? (
                <div className="callout error" style={{ marginTop: 16 }}>
                  {t.failed}
                </div>
              ) : null}
              <form action={updatePassword} className="form">
                <div className="field">
                  <label htmlFor="password">{t.newPassword}</label>
                  <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
                </div>
                <div className="field">
                  <label htmlFor="confirm">{t.confirmPassword}</label>
                  <input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
                </div>
                <button className="btn primary block" type="submit">
                  {t.updatePassword}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
