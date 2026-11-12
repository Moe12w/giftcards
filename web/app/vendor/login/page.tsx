import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';
import { Notice } from '@/components/ui';
import { vendorSignIn } from '@/lib/actions/auth';
import { createClient } from '@/lib/supabase/server';
import { pick } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { getLocale } from '@/lib/i18n/server';
import { vendorCopy } from '@/lib/i18n/vendor';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: pick(vendorCopy, locale).login.metaTitle };
}

export default async function VendorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; next?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const t = pick(vendorCopy, locale).login;
  const c = pick(common, locale);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: membership } = await supabase
      .from('vendor_members')
      .select('vendor_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .limit(1)
      .maybeSingle();
    if (membership) redirect('/vendor');
  }

  const notice =
    params.notice === 'reset-sent'
      ? t.noticeReset
      : params.notice === 'finish'
        ? t.noticeFinish
        : null;

  return (
    <AuthShell
      tone="mint"
      eyebrow={t.shellEyebrow}
      title={t.shellTitle}
      description={t.shellDescription}
      points={[t.point1, t.point2, t.point3]}
    >
      <span className="eyebrow mint">{t.eyebrow}</span>
      <h1 style={{ marginTop: 14 }}>{t.heading}</h1>
      <p style={{ marginTop: 10 }}>
        {t.subheading}
      </p>
      <Notice error={params.error} success={notice} />
      <form action={vendorSignIn} className="form" style={{ marginTop: 20 }}>
        {params.next ? <input type="hidden" name="next" value={params.next} /> : null}
        <div className="field">
          <label htmlFor="email">{c.labels.email}</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@business.qa"
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
        <button className="btn primary block" type="submit">
          {t.signIn} <ArrowRight size={16} />
        </button>
      </form>
      <div className="auth-links" style={{ marginTop: 16 }}>
        <Link href="/vendor/forgot-password">{t.forgotPassword}</Link>
        <Link href="/vendor/register">{t.applyAsVendor}</Link>
      </div>
      <div className="auth-switch">
        {t.teamHint} <br />
        {t.otherPortal} <Link href="/enterprise/login">{t.enterprise}</Link> ·{' '}
        <Link href="/admin/login">{t.admin}</Link>
      </div>
    </AuthShell>
  );
}
