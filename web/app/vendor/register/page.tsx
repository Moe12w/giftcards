import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, BadgeCheck } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';
import { Notice } from '@/components/ui';
import { registerVendorAccount } from '@/lib/actions/auth';
import { createClient } from '@/lib/supabase/server';
import { pick } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { getLocale } from '@/lib/i18n/server';
import { vendorCopy } from '@/lib/i18n/vendor';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: pick(vendorCopy, locale).register.metaTitle };
}

export default async function VendorRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const t = pick(vendorCopy, locale).register;
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

  const categoriesResult = await supabase
    .from('categories')
    .select('name')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  const categories = categoriesResult.data ?? [];

  return (
    <AuthShell
      tone="mint"
      eyebrow={t.shellEyebrow}
      title={t.shellTitle}
      description={t.shellDescription}
      points={[t.point1, t.point2, t.point3]}
    >
      <span className="eyebrow mint">{t.eyebrow}</span>
      <h1 style={{ marginTop: 14 }}>{user ? t.lastStep : t.joinMarketplace}</h1>
      <p style={{ marginTop: 10 }}>
        {user ? t.accountReady : t.createAccount}
      </p>
      <Notice
        error={params.error}
        success={
          params.notice === 'confirm-email'
            ? t.noticeConfirmEmail
            : params.notice === 'finish'
              ? t.noticeFinish
              : null
        }
      />

      <form action={registerVendorAccount} className="form" style={{ marginTop: 20 }}>
        {!user ? (
          <>
            <div className="field">
              <label htmlFor="full_name">{t.yourName}</label>
              <input
                id="full_name"
                name="full_name"
                required
                placeholder={t.fullNamePlaceholder}
              />
            </div>
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
                autoComplete="new-password"
                required
                minLength={8}
                placeholder={t.passwordPlaceholder}
              />
            </div>
          </>
        ) : (
          <div className="callout info">
            {t.signedInAs} <strong>{user.email}</strong>
          </div>
        )}

        <hr className="divider" />

        <div className="field">
          <label htmlFor="business_name">{t.businessName}</label>
          <input
            id="business_name"
            name="business_name"
            required
            placeholder={t.businessNamePlaceholder}
          />
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="business_category">{c.labels.category}</label>
            <select id="business_category" name="business_category" defaultValue="">
              <option value="">{t.chooseCategory}</option>
              {categories.map((category) => (
                <option key={category.name} value={category.name}>
                  {category.name}
                </option>
              ))}
              <option value="Other">{t.other}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="business_location">{t.area}</label>
            <input
              id="business_location"
              name="business_location"
              placeholder={`${t.westBay}, ${t.doha}`}
            />
          </div>
          <div className="field">
            <label htmlFor="business_phone">{c.labels.phone}</label>
            <input id="business_phone" name="business_phone" placeholder="+974 …" />
          </div>
          <div className="field">
            <label htmlFor="business_website">{t.website}</label>
            <input id="business_website" name="business_website" placeholder="https://…" />
          </div>
          <div className="field full">
            <label htmlFor="business_email">{t.businessEmail}</label>
            <input
              id="business_email"
              name="business_email"
              type="email"
              defaultValue={user?.email ?? ''}
              placeholder="hello@business.qa"
            />
          </div>
          <div className="field full">
            <label htmlFor="business_description">{t.offer}</label>
            <textarea
              id="business_description"
              name="business_description"
              placeholder={t.offerPlaceholder}
            />
          </div>
        </div>

        <button className="btn primary block" type="submit">
          {t.submitApplication} <ArrowRight size={16} />
        </button>
        <p className="small muted">
          <BadgeCheck size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t.termsBefore}{' '}
          <Link href="/terms">{t.termsLink}</Link>
          {t.termsAfter}
        </p>
      </form>

      <div className="auth-switch">
        {t.alreadyAccount} <Link href="/vendor/login">{t.signIn}</Link>
      </div>
    </AuthShell>
  );
}
