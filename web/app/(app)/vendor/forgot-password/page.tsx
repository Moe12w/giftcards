import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Send } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';
import { Notice } from '@/components/ui';
import { requestPasswordReset } from '@/lib/actions/auth';
import { pick } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { getLocale } from '@/lib/i18n/server';
import { vendorCopy } from '@/lib/i18n/vendor';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: pick(vendorCopy, locale).forgotPassword.metaTitle };
}

export default async function VendorForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const t = pick(vendorCopy, locale).forgotPassword;
  const c = pick(common, locale);

  return (
    <AuthShell
      tone="mint"
      eyebrow={t.shellEyebrow}
      title={t.shellTitle}
      description={t.shellDescription}
    >
      <span className="eyebrow mint">{t.eyebrow}</span>
      <h1 style={{ marginTop: 14 }}>{t.heading}</h1>
      <p style={{ marginTop: 10 }}>
        {t.subheading}
      </p>
      <Notice
        error={params.error}
        success={params.sent === '1' ? t.noticeSent : null}
      />
      <form action={requestPasswordReset} className="form" style={{ marginTop: 20 }}>
        <input type="hidden" name="portal" value="vendor" />
        <div className="field">
          <label htmlFor="email">{c.labels.email}</label>
          <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@business.qa" />
        </div>
        <button className="btn primary block" type="submit">
          {t.sendResetLink} <Send size={16} />
        </button>
      </form>
      <div className="auth-switch">
        <Link href="/vendor/login">
          <ArrowLeft size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t.backToSignIn}
        </Link>
      </div>
    </AuthShell>
  );
}
