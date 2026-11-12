import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Send } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';
import { Notice } from '@/components/ui';
import { requestPasswordReset } from '@/lib/actions/auth';
import { adminCopy } from '@/lib/i18n/admin';
import { pick } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: pick(adminCopy, locale).titles.forgotPassword };
}

export default async function AdminForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const t = pick(adminCopy, locale).forgotPassword;

  return (
    <AuthShell
      tone="coral"
      eyebrow={t.eyebrow}
      title={t.title}
      description={t.description}
    >
      <span className="eyebrow coral">{t.passwordReset}</span>
      <h1 style={{ marginTop: 14 }}>{t.forgotPassword}</h1>
      <p style={{ marginTop: 10 }}>{t.enterEmail}</p>
      <Notice
        error={params.error}
        success={
          params.sent === '1'
            ? t.resetSent
            : null
        }
      />
      <form action={requestPasswordReset} className="form" style={{ marginTop: 20 }}>
        <input type="hidden" name="portal" value="admin" />
        <div className="field">
          <label htmlFor="email">{t.adminEmail}</label>
          <input id="email" name="email" type="email" autoComplete="email" required placeholder="admin@giftly.qa" />
        </div>
        <button className="btn coral block" type="submit">
          {t.sendResetLink} <Send size={16} />
        </button>
      </form>
      <div className="auth-switch">
        <Link href="/admin/login">
          <ArrowLeft size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t.backToSignIn}
        </Link>
      </div>
    </AuthShell>
  );
}
