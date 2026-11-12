import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Users } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';
import { Notice } from '@/components/ui';
import { acceptVendorInvite } from '@/lib/actions/auth';
import { createClient } from '@/lib/supabase/server';
import { pick } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';
import { vendorCopy } from '@/lib/i18n/vendor';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: pick(vendorCopy, locale).join.metaTitle };
}

export default async function VendorJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? '';
  const locale = await getLocale();
  const t = pick(vendorCopy, locale).join;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = `/vendor/join?token=${encodeURIComponent(token)}`;
    redirect(`/vendor/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <AuthShell
      tone="mint"
      eyebrow={t.shellEyebrow}
      title={t.shellTitle}
      description={t.shellDescription}
    >
      <span className="eyebrow mint">
        <Users size={14} /> {t.eyebrow}
      </span>
      <h1 style={{ marginTop: 14 }}>{t.heading}</h1>
      <p style={{ marginTop: 10 }}>
        {t.signedInAsBefore} <strong>{user.email}</strong>
        {t.signedInAsAfter}
      </p>
      <Notice error={params.error} />
      {token ? (
        <form action={acceptVendorInvite} className="form" style={{ marginTop: 20 }}>
          <input type="hidden" name="token" value={token} />
          <button className="btn primary block" type="submit">
            {t.acceptInvite} <ArrowRight size={16} />
          </button>
        </form>
      ) : (
        <div className="callout error" style={{ marginTop: 18 }}>
          {t.missingToken}
        </div>
      )}
      <div className="auth-switch">
        {t.notRightAccount} <Link href="/vendor/login">{t.signInAnother}</Link>.
      </div>
    </AuthShell>
  );
}
