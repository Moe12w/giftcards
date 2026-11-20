import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Building2, CheckCircle2, Store } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';
import { Notice } from '@/components/ui';
import { PasswordField } from '@/components/PasswordField';
import { registerEnterpriseAccount } from '@/lib/actions/auth';
import { createClient } from '@/lib/supabase/server';
import { pick } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';
import { enterpriseCopy } from '@/lib/i18n/enterprise';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: pick(enterpriseCopy, locale).login.metaTitle.replace('Sign in', 'Register') };
}

const PASSWORD_COPY = {
  show: 'Show password',
  hide: 'Hide password',
  weak: 'Weak',
  fair: 'Fair',
  good: 'Good',
  strong: 'Strong',
};

export default async function EnterpriseRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const params = await searchParams;
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
      eyebrow="Enterprise"
      title="Create your organisation account"
      description="Set up your organisation now, then invite branches and team members from your dashboard."
      points={[
        'Centralised organisation management',
        'Multiple branches and team roles',
        'One payment application for the whole organisation',
      ]}
    >
      <span className="eyebrow lavender">Join Giftly</span>
      <h1 style={{ marginTop: 14 }}>Create your organisation account</h1>
      <p style={{ marginTop: 10 }}>
        Start with the basics. You will add branches, team members and payment details from inside your
        dashboard.
      </p>

      <Notice
        error={
          params.error === 'no-partner'
            ? 'You are signed in but do not have an organisation record yet. Accept the terms and continue to create it.'
            : params.error
        }
        success={params.notice === 'confirm-email' ? 'Check your inbox to confirm your email, then sign in.' : null}
      />

      {!user ? (
        <div className="grid-2" style={{ marginTop: 18 }}>
          <Link
            href="/vendor/register"
            className="card"
            style={{ padding: 16, display: 'grid', gap: 6, textDecoration: 'none' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Store size={16} /> <strong>Vendor</strong>
            </span>
            <span className="small muted">
              Independent businesses, shops, restaurants, salons and service providers.
            </span>
            <span className="tag neutral" style={{ justifySelf: 'start' }}>
              Switch
            </span>
          </Link>
          <div
            className="card"
            style={{ padding: 16, display: 'grid', gap: 6, borderColor: 'var(--ink)', boxShadow: 'var(--shadow-soft)' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={16} /> <strong>Enterprise</strong>
            </span>
            <span className="small muted">
              Companies, corporate groups and organisations with multiple branches.
            </span>
            <span className="tag success" style={{ justifySelf: 'start' }}>
              <CheckCircle2 size={12} /> Selected
            </span>
          </div>
        </div>
      ) : null}

      <form action={registerEnterpriseAccount} className="form" style={{ marginTop: 20 }}>
        {!user ? (
          <>
            <div className="field">
              <label htmlFor="full_name">Your full name</label>
              <input id="full_name" name="full_name" required autoComplete="name" />
            </div>
            <div className="field">
              <label htmlFor="email">Business email</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@company.qa"
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
            <PasswordField label="Password" placeholder="At least 8 characters" copy={PASSWORD_COPY} />
          </>
        ) : (
          <div className="callout info">
            Signed in as <strong>{user.email}</strong>
          </div>
        )}

        <label className="small" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', lineHeight: 1.5 }}>
          <input type="checkbox" name="terms" required style={{ marginTop: 3 }} />
          <span>
            I agree to the <Link href="/terms">Terms of Service</Link> and the{' '}
            <Link href="/privacy">Privacy Policy</Link>, and I confirm I am authorised to act for this
            organisation.
          </span>
        </label>

        <button className="btn primary block" type="submit">
          Create account <ArrowRight size={16} />
        </button>
        <p className="small muted">
          You will get your dashboard immediately. Payment processing documents can be completed later
          from Online Payments.
        </p>
      </form>

      <div className="auth-switch">
        Already have an account? <Link href="/enterprise/login">Sign in</Link>
      </div>
    </AuthShell>
  );
}
