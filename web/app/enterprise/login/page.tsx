import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';
import { Notice } from '@/components/ui';
import { enterpriseSignIn } from '@/lib/actions/auth';
import { createClient } from '@/lib/supabase/server';
import { pick } from '@/lib/i18n';
import { enterpriseCopy } from '@/lib/i18n/enterprise';
import { getLocale } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: pick(enterpriseCopy, locale).login.metaTitle };
}

export default async function EnterpriseLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const t = pick(enterpriseCopy, locale).login;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: membership } = await supabase
      .from('enterprise_members')
      .select('partner_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .limit(1)
      .maybeSingle();
    if (membership) redirect('/enterprise');
  }

  return (
    <AuthShell
      tone="lavender"
      eyebrow={t.shellEyebrow}
      title={t.shellTitle}
      description={t.shellDescription}
      points={[
        t.point1,
        t.point2,
        t.point3,
      ]}
    >
      <span className="eyebrow lavender">{t.eyebrow}</span>
      <h1 style={{ marginTop: 14 }}>{t.heading}</h1>
      <p style={{ marginTop: 10 }}>
        {t.subheading}
      </p>
      <Notice
        error={params.error}
        success={
          params.notice === 'reset-sent'
            ? t.noticeReset
            : null
        }
      />
      <form action={enterpriseSignIn} className="form" style={{ marginTop: 20 }}>
        <div className="field">
          <label htmlFor="email">{t.workEmail}</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@company.com"
          />
        </div>
        <div className="field">
          <label htmlFor="password">{t.password}</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
          />
        </div>
        <button className="btn lavender block" type="submit">
          {t.signIn} <ArrowRight size={16} />
        </button>
      </form>
      <div className="auth-links" style={{ marginTop: 16 }}>
        <Link href="/enterprise/forgot-password">{t.forgotPassword}</Link>
        <Link href="/corporate#enquiry">{t.becomePartner}</Link>
      </div>
      <div className="auth-switch">
        {t.notSetUp} <Link href="/corporate#enquiry">{t.talkToCorporate}</Link>.
        <br />
        {t.vendorInstead} <Link href="/vendor/login">{t.vendorPortal}</Link>.
      </div>
    </AuthShell>
  );
}
