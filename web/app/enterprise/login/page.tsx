import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';
import { Notice } from '@/components/ui';
import { enterpriseSignIn } from '@/lib/actions/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Enterprise sign in' };

export default async function EnterpriseLoginPage({
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
      eyebrow="Enterprise portal"
      title="Bulk rewards, without the spreadsheet chaos."
      description="Sign in to manage your catalogue, import and allocate codes, and see exactly what has been redeemed."
      points={[
        'Encrypted code inventory and allocation',
        'Delivery and redemption reporting',
        'Exportable data for finance',
      ]}
    >
      <span className="eyebrow lavender">Enterprise sign in</span>
      <h1 style={{ marginTop: 14 }}>Welcome back.</h1>
      <p style={{ marginTop: 10 }}>
        Use the work email linked to your partner account.
      </p>
      <Notice
        error={params.error}
        success={
          params.notice === 'reset-sent'
            ? 'If that email has an account, a reset link is on its way.'
            : null
        }
      />
      <form action={enterpriseSignIn} className="form" style={{ marginTop: 20 }}>
        <div className="field">
          <label htmlFor="email">Work email</label>
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
          <label htmlFor="password">Password</label>
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
          Sign in <ArrowRight size={16} />
        </button>
      </form>
      <div className="auth-links" style={{ marginTop: 16 }}>
        <Link href="/enterprise/forgot-password">Forgot your password?</Link>
        <Link href="/corporate#enquiry">Become a partner</Link>
      </div>
      <div className="auth-switch">
        Not set up yet? <Link href="/corporate#enquiry">Talk to our corporate team</Link>.
        <br />
        Vendor instead? <Link href="/vendor/login">Vendor portal</Link>.
      </div>
    </AuthShell>
  );
}
