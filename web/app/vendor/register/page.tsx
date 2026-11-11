import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, BadgeCheck } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';
import { Notice } from '@/components/ui';
import { registerVendorAccount } from '@/lib/actions/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Apply as a vendor' };

export default async function VendorRegisterPage({
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
      .from('vendor_members')
      .select('vendor_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .limit(1)
      .maybeSingle();
    if (membership) redirect('/vendor');
  }

  const categoriesResult = await supabase
    .from('categories')
    .select('name')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  const categories = categoriesResult.data ?? [];

  return (
    <AuthShell
      tone="mint"
      eyebrow="Become a vendor"
      title="Sell gifts people are happy to receive."
      description="Tell us about your business. We review every application, then help you publish your first offer."
      points={[
        'No listing fee — commission only on sales',
        'Set your own amounts and experience packages',
        'Redeem with a code, get clear reports',
      ]}
    >
      <span className="eyebrow mint">Vendor application</span>
      <h1 style={{ marginTop: 14 }}>{user ? 'One last step.' : 'Join the marketplace.'}</h1>
      <p style={{ marginTop: 10 }}>
        {user
          ? 'Your account is ready. Tell us about the business so we can review it.'
          : 'Create your account and tell us about the business in one go.'}
      </p>
      <Notice
        error={params.error}
        success={
          params.notice === 'confirm-email'
            ? 'Account created. Check your inbox to confirm your email, then sign in to finish the application.'
            : params.notice === 'finish'
              ? 'Sign in complete. Add your business details below.'
              : null
        }
      />

      <form action={registerVendorAccount} className="form" style={{ marginTop: 20 }}>
        {!user ? (
          <>
            <div className="field">
              <label htmlFor="full_name">Your name</label>
              <input id="full_name" name="full_name" required placeholder="Full name" />
            </div>
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
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="At least 8 characters"
              />
            </div>
          </>
        ) : (
          <div className="callout info">
            Signed in as <strong>{user.email}</strong>
          </div>
        )}

        <hr className="divider" />

        <div className="field">
          <label htmlFor="business_name">Business name</label>
          <input id="business_name" name="business_name" required placeholder="The Coffee House" />
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="business_category">Category</label>
            <select id="business_category" name="business_category" defaultValue="">
              <option value="">Choose a category</option>
              {categories.map((category) => (
                <option key={category.name} value={category.name}>
                  {category.name}
                </option>
              ))}
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="business_location">Area</label>
            <input id="business_location" name="business_location" placeholder="West Bay, Doha" />
          </div>
          <div className="field">
            <label htmlFor="business_phone">Phone</label>
            <input id="business_phone" name="business_phone" placeholder="+974 …" />
          </div>
          <div className="field">
            <label htmlFor="business_website">Website or Instagram</label>
            <input id="business_website" name="business_website" placeholder="https://…" />
          </div>
          <div className="field full">
            <label htmlFor="business_email">Business email</label>
            <input
              id="business_email"
              name="business_email"
              type="email"
              defaultValue={user?.email ?? ''}
              placeholder="hello@business.qa"
            />
          </div>
          <div className="field full">
            <label htmlFor="business_description">What will you offer?</label>
            <textarea
              id="business_description"
              name="business_description"
              placeholder="A short description of your business and the gifts you would like to sell."
            />
          </div>
        </div>

        <button className="btn primary block" type="submit">
          Submit application <ArrowRight size={16} />
        </button>
        <p className="small muted">
          <BadgeCheck size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> By applying
          you agree to our <Link href="/terms">vendor terms</Link>. We usually review applications
          within two working days.
        </p>
      </form>

      <div className="auth-switch">
        Already have an account? <Link href="/vendor/login">Sign in</Link>
      </div>
    </AuthShell>
  );
}
