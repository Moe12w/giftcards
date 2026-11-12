import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Send } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';
import { Notice } from '@/components/ui';
import { requestPasswordReset } from '@/lib/actions/auth';
import { pick } from '@/lib/i18n';
import { enterpriseCopy } from '@/lib/i18n/enterprise';
import { getLocale } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: pick(enterpriseCopy, locale).forgotPassword.metaTitle };
}

export default async function EnterpriseForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const t = pick(enterpriseCopy, locale).forgotPassword;

  return (
    <AuthShell
      tone="lavender"
      eyebrow={t.shellEyebrow}
      title={t.shellTitle}
      description={t.shellDescription}
    >
      <span className="eyebrow lavender">{t.eyebrow}</span>
      <h1 style={{ marginTop: 14 }}>{t.heading}</h1>
      <p style={{ marginTop: 10 }}>
        {t.subheading}
      </p>
      <Notice
        error={params.error}
        success={
          params.sent === '1'
            ? t.noticeSent
            : null
        }
      />
      <form action={requestPasswordReset} className="form" style={{ marginTop: 20 }}>
        <input type="hidden" name="portal" value="enterprise" />
        <div className="field">
          <label htmlFor="email">{t.workEmail}</label>
          <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
        </div>
        <button className="btn lavender block" type="submit">
          {t.sendResetLink} <Send size={16} />
        </button>
      </form>
      <div className="auth-switch">
        <Link href="/enterprise/login">
          <ArrowLeft size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t.backToSignIn}
        </Link>
      </div>
    </AuthShell>
  );
}
