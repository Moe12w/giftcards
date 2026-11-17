import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Building2, CheckCircle2, Store } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';
import { Notice } from '@/components/ui';
import { PasswordField } from '@/components/PasswordField';
import { registerVendorAccount } from '@/lib/actions/auth';
import { createClient } from '@/lib/supabase/server';
import { pick } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';
import { vendorCopy } from '@/lib/i18n/vendor';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: pick(vendorCopy, locale).register.metaTitle };
}

const PASSWORD_COPY = {
  show: 'Show password',
  hide: 'Hide password',
  weak: 'Weak',
  fair: 'Fair',
  good: 'Good',
  strong: 'Strong',
};

export default async function VendorRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const t = pick(vendorCopy, locale).register;
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

  return (
    <AuthShell
      tone="mint"
      eyebrow={t.shellEyebrow}
      title={t.shellTitle}
      description={t.shellDescription}
      points={[t.point1, t.point2, t.point3]}
    >
      <span className="eyebrow mint">{t.eyebrow}</span>
      <h1 style={{ marginTop: 14 }}>{user ? t.lastStep : 'Create your business account'}</h1>
      <p style={{ marginTop: 10 }}>
        {user
          ? t.accountReady
          : 'Start with the basics. You will set up your storefront, documents and payments from inside your dashboard.'}
      </p>

      <Notice
        error={
          params.error === 'no-vendor'
            ? 'You are signed in but do not have a business record yet. Accept the terms and continue to create it.'
            : params.error
        }
        success={
          params.notice === 'confirm-email'
            ? t.noticeConfirmEmail
            : params.notice === 'finish'
              ? t.noticeFinish
              : null
        }
      />

      {!user ? (
        <div className="grid-2" style={{ marginTop: 18 }}>
          <div
            className="card"
            style={{ padding: 16, display: 'grid', gap: 6, borderColor: 'var(--ink)', boxShadow: 'var(--shadow-soft)' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Store size={16} /> <strong>Vendor</strong>
            </span>
            <span className="small muted">
              Independent businesses, shops, restaurants, salons and service providers.
            </span>
            <span className="tag success" style={{ justifySelf: 'start' }}>
              <CheckCircle2 size={12} /> Selected
            </span>
          </div>
          <Link
            href="/enterprise/register"
            className="card"
            style={{ padding: 16, display: 'grid', gap: 6, textDecoration: 'none' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={16} /> <strong>Enterprise</strong>
            </span>
            <span className="small muted">
              Companies, corporate groups and organisations with multiple branches.
            </span>
            <span className="tag neutral" style={{ justifySelf: 'start' }}>
              Switch
            </span>
          </Link>
        </div>
      ) : null}

      <form action={registerVendorAccount} className="form" style={{ marginTop: 20 }}>
        {!user ? (
          <>
            <div className="field">
              <label htmlFor="full_name">{t.yourName}</label>
              <input id="full_name" name="full_name" required placeholder={t.fullNamePlaceholder} />
            </div>
            <div className="field">
              <label htmlFor="email">Business email</label>
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
              <label htmlFor="mobile">Mobile number</label>
              <input
                id="mobile"
                name="mobile"
                type="tel"
                autoComplete="tel"
                required
                placeholder="+974 5555 5555"
              />
            </div>
            <PasswordField label={t.password} placeholder={t.passwordPlaceholder} copy={PASSWORD_COPY} />
          </>
        ) : (
          <div className="callout info">
            {t.signedInAs} <strong>{user.email}</strong>
          </div>
        )}

        <label
          className="small"
          style={{ display: 'flex', gap: 10, alignItems: 'flex-start', lineHeight: 1.5 }}
        >
          <input type="checkbox" name="terms" required style={{ marginTop: 3 }} />
          <span>
            I agree to the <Link href="/terms">Terms of Service</Link> and the{' '}
            <Link href="/privacy">Privacy Policy</Link>, and I confirm I am authorised to act for this
            business.
          </span>
        </label>

        <button className="btn primary block" type="submit">
          {t.submitApplication} <ArrowRight size={16} />
        </button>
        <p className="small muted">
          You will get your dashboard immediately. Payment processing documents can be completed later
          from Online Payments.
        </p>
      </form>

      <div className="auth-switch">
        {t.alreadyAccount} <Link href="/vendor/login">{t.signIn}</Link>
      </div>
    </AuthShell>
  );
}
