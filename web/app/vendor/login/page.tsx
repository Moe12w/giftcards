import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';
import { Notice } from '@/components/ui';
import { vendorSignIn } from '@/lib/actions/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Vendor sign in' };

export default async function VendorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; next?: string }>;
}) {
  const params = await searchParams;
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
      ? 'If that email has an account, a reset link is on its way.'
      : params.notice === 'finish'
        ? 'Sign in to finish your vendor application.'
        : null;

  return (
    <AuthShell
      tone="mint"
      eyebrow="Vendor portal"
      title="Your offers, orders and redemptions in one place."
      description="Sign in to manage the gifts you sell, redeem codes at the counter and see how your business is doing."
      points={[
        'Publish gift cards and experience packages',
        'Redeem with a code — balances update instantly',
        'Track sales, commission and settlements',
      ]}
    >
      <span className="eyebrow mint">Vendor sign in</span>
      <h1 style={{ marginTop: 14 }}>Welcome back.</h1>
      <p style={{ marginTop: 10 }}>
        Use the email address linked to your vendor account.
      </p>
      <Notice error={params.error} success={notice} />
      <form action={vendorSignIn} className="form" style={{ marginTop: 20 }}>
        {params.next ? <input type="hidden" name="next" value={params.next} /> : null}
        <div className="field">
          <label htmlFor="email">Email</label>
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
        <button className="btn primary block" type="submit">
          Sign in <ArrowRight size={16} />
        </button>
      </form>
      <div className="auth-links" style={{ marginTop: 16 }}>
        <Link href="/vendor/forgot-password">Forgot your password?</Link>
        <Link href="/vendor/register">Apply as a vendor</Link>
      </div>
      <div className="auth-switch">
        Part of a team? Use the invite link your owner sent you, then sign in here. <br />
        Looking for a different portal? <Link href="/enterprise/login">Enterprise</Link> ·{' '}
        <Link href="/admin/login">Admin</Link>
      </div>
    </AuthShell>
  );
}
