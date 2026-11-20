import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, BadgeCheck, Building2 } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';
import { Notice } from '@/components/ui';
import { registerBusinessAccount } from '@/lib/actions/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Business / bulk buyer registration' };

export default async function BusinessRegisterPage({
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
    const { data: account } = await supabase
      .from('business_accounts')
      .select('id, status')
      .eq('user_id', user.id)
      .maybeSingle();
    if (account?.status === 'approved') redirect('/business');
    if (account) redirect(`/business/status?status=${encodeURIComponent(account.status)}`);
  }

  const notice =
    params.notice === 'confirm-email'
      ? 'Check your email to confirm your account, then sign in to complete your business registration.'
      : params.notice === 'finish'
        ? 'Sign in and complete your business registration to access bulk purchasing.'
        : null;

  return (
    <AuthShell
      tone="lavender"
      eyebrow="Buying for a business?"
      title="Access exclusive corporate deals and bulk gift card pricing."
      description="Register your company to buy gift cards in bulk for rewards, incentives, events and employee benefits. Your account will be reviewed before bulk offers are unlocked."
      points={[
        'Exclusive bulk prices and volume tiers, visible only to approved business accounts',
        'Bulk checkout, order history, invoices and gift card distribution',
        'Approval managed by Giftly for secure corporate purchasing',
      ]}
    >
      <span className="eyebrow lavender"><Building2 size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Business / Bulk Buyer</span>
      <h1 style={{ marginTop: 14 }}>{user ? 'Complete your business profile' : 'Create your business account'}</h1>
      <p style={{ marginTop: 10 }}>
        {user ? 'Tell us about your company so we can review access to bulk purchasing.' : 'Create an account and submit your company details for approval.'}
      </p>
      <Notice error={params.error} success={notice} />

      <form action={registerBusinessAccount} className="form" style={{ marginTop: 20 }}>
        {!user ? (
          <>
            <div className="field">
              <label htmlFor="contact_name">Contact person’s name</label>
              <input id="contact_name" name="contact_name" required placeholder="Full name" />
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="business_email">Business email</label>
                <input id="business_email" name="business_email" type="email" autoComplete="email" required placeholder="you@company.com" />
              </div>
              <div className="field">
                <label htmlFor="password">Password</label>
                <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="At least 8 characters" />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="callout info">Signed in as <strong>{user.email}</strong></div>
            <div className="field">
              <label htmlFor="contact_name">Contact person’s name</label>
              <input id="contact_name" name="contact_name" required placeholder="Full name" />
            </div>
            <div className="field">
              <label htmlFor="business_email">Business email</label>
              <input id="business_email" name="business_email" type="email" defaultValue={user.email ?? ''} required />
            </div>
          </>
        )}

        <hr className="divider" />

        <div className="form-grid">
          <div className="field full">
            <label htmlFor="company_name">Company name</label>
            <input id="company_name" name="company_name" required placeholder="Company name" />
          </div>
          <div className="field">
            <label htmlFor="phone">Phone number</label>
            <input id="phone" name="phone" placeholder="+974 …" />
          </div>
          <div className="field">
            <label htmlFor="country">Country</label>
            <input id="country" name="country" defaultValue="Qatar" />
          </div>
          <div className="field">
            <label htmlFor="company_registration_number">Company registration number (optional)</label>
            <input id="company_registration_number" name="company_registration_number" placeholder="CR number" />
          </div>
          <div className="field">
            <label htmlFor="business_type">Business type / industry</label>
            <input id="business_type" name="business_type" placeholder="e.g. HR, Retail, Events" />
          </div>
        </div>

        <button className="btn primary block" type="submit">
          {user ? 'Submit for approval' : 'Create business account'} <ArrowRight size={16} />
        </button>
        <p className="small muted">
          <BadgeCheck size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> By continuing you agree to our{' '}
          <Link href="/terms">terms</Link> and <Link href="/privacy">privacy policy</Link>. Access to bulk prices requires approval.
        </p>
      </form>

      <div className="auth-switch">
        Already registered? <Link href="/business/login">Sign in</Link> · Buying for yourself? <Link href="/download">Get the app</Link>
      </div>
    </AuthShell>
  );
}
