import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';
import { Notice } from '@/components/ui';
import { adminSignIn } from '@/lib/actions/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Admin sign in' };

export default async function AdminLoginPage({
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
    const [{ data: role }, { data: profile }] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
      supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle(),
    ]);
    if (role?.role === 'admin' || profile?.is_admin) redirect('/admin');
  }

  return (
    <AuthShell
      tone="coral"
      eyebrow="Platform admin"
      title="The whole marketplace, one view."
      description="Review applications, moderate offers, support customers and keep the ledger honest."
      points={[
        'Vendor approvals and commission control',
        'Orders, vouchers and redemption oversight',
        'Audit trail for every sensitive action',
      ]}
    >
      <span className="eyebrow coral">
        <ShieldCheck size={14} /> Admin only
      </span>
      <h1 style={{ marginTop: 14 }}>Sign in.</h1>
      <p style={{ marginTop: 10 }}>
        This portal is restricted to Giftly platform administrators.
      </p>
      <Notice
        error={params.error}
        success={
          params.notice === 'reset-sent'
            ? 'If that email has an account, a reset link is on its way.'
            : null
        }
      />
      <form action={adminSignIn} className="form" style={{ marginTop: 20 }}>
        <div className="field">
          <label htmlFor="email">Admin email</label>
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
        <button className="btn coral block" type="submit">
          Sign in
        </button>
      </form>
      <div className="auth-links" style={{ marginTop: 16 }}>
        <Link href="/admin/forgot-password">Forgot your password?</Link>
      </div>
      <div className="auth-switch">
        Not an admin? <Link href="/vendor/login">Vendor portal</Link> ·{' '}
        <Link href="/enterprise/login">Enterprise portal</Link>
      </div>
    </AuthShell>
  );
}
