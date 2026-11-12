import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Building2 } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';
import { Notice } from '@/components/ui';
import { businessSignIn } from '@/lib/actions/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Business sign in' };

export default async function BusinessLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: account } = await supabase
      .from('business_accounts')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle();
    if (account?.status === 'approved') redirect('/business');
    if (account) redirect(`/business/status?status=${encodeURIComponent(account.status)}`);
  }

  return (
    <AuthShell
      tone="lavender"
      eyebrow="Business / Bulk Buyer"
      title="Sign in to your bulk purchasing account."
      description="Approved business accounts can browse exclusive bulk deals, place bulk orders, and manage invoices and gift card distribution."
      points={[
        'Access restricted bulk offers and volume pricing',
        'Track bulk orders and payment status',
        'Download invoices, receipts and voucher exports',
      ]}
    >
      <span className="eyebrow lavender"><Building2 size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Corporate & bulk buying</span>
      <h1 style={{ marginTop: 14 }}>Sign in</h1>
      <p style={{ marginTop: 10 }}>Use the business email and password you registered with.</p>
      <Notice error={params.error} />

      <form action={businessSignIn} className="form" style={{ marginTop: 20 }}>
        {params.next ? <input type="hidden" name="next" value={params.next} /> : null}
        <div className="field">
          <label htmlFor="email">Business email</label>
          <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
        </div>
        <button className="btn primary block" type="submit">
          Sign in <ArrowRight size={16} />
        </button>
      </form>

      <div className="auth-links" style={{ marginTop: 16 }}>
        <Link href="/vendor/forgot-password">Forgot password?</Link>
        <Link href="/business/register">Register for bulk buying</Link>
      </div>
      <div className="auth-switch">
        Partner/supplier portal? <Link href="/enterprise/login">Enterprise sign in</Link>
      </div>
    </AuthShell>
  );
}
