import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';
import { Notice } from '@/components/ui';
import { adminSignIn } from '@/lib/actions/auth';
import { createClient } from '@/lib/supabase/server';
import { adminCopy } from '@/lib/i18n/admin';
import { pick } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: pick(adminCopy, locale).titles.login };
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const t = pick(adminCopy, locale).login;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const [{ data: role }, { data: profile }] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
      supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle(),
    ]);
    if (role?.role === 'admin' || profile?.is_admin) redirect('/admin');
  }

  return (
    <AuthShell
      tone="coral"
      eyebrow={t.eyebrow}
      title={t.title}
      description={t.description}
      points={[t.point1, t.point2, t.point3]}
    >
      <span className="eyebrow coral">
        <ShieldCheck size={14} /> {t.adminOnly}
      </span>
      <h1 style={{ marginTop: 14 }}>{t.signIn}</h1>
      <p style={{ marginTop: 10 }}>
        {t.restricted}
      </p>
      <Notice
        error={params.error}
        success={
          params.notice === 'reset-sent'
            ? t.resetSent
            : null
        }
      />
      <form action={adminSignIn} className="form" style={{ marginTop: 20 }}>
        <div className="field">
          <label htmlFor="email">{t.adminEmail}</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="admin@giftly.qa"
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
        <button className="btn coral block" type="submit">
          {t.signInButton}
        </button>
      </form>
      <div className="auth-links" style={{ marginTop: 16 }}>
        <Link href="/admin/forgot-password">{t.forgotPassword}</Link>
      </div>
      <div className="auth-switch">
        {t.notAdmin} <Link href="/vendor/login">{t.vendorPortal}</Link> ·{' '}
        <Link href="/enterprise/login">{t.enterprisePortal}</Link>
      </div>
    </AuthShell>
  );
}
