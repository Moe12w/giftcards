import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Users } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';
import { Notice } from '@/components/ui';
import { acceptVendorInvite } from '@/lib/actions/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Join a vendor team' };

export default async function VendorJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? '';
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
      eyebrow="Team invite"
      title="You have been invited to a vendor team."
      description="Accept the invite to see the vendor dashboard. Your access is limited by the role the owner chose."
    >
      <span className="eyebrow mint">
        <Users size={14} /> Team invite
      </span>
      <h1 style={{ marginTop: 14 }}>Join the team.</h1>
      <p style={{ marginTop: 10 }}>
        You are signed in as <strong>{user.email}</strong>. The invite only works for this email
        address.
      </p>
      <Notice error={params.error} />
      {token ? (
        <form action={acceptVendorInvite} className="form" style={{ marginTop: 20 }}>
          <input type="hidden" name="token" value={token} />
          <button className="btn primary block" type="submit">
            Accept invite <ArrowRight size={16} />
          </button>
        </form>
      ) : (
        <div className="callout error" style={{ marginTop: 18 }}>
          This link is missing its invite token. Ask the vendor owner to send it again.
        </div>
      )}
      <div className="auth-switch">
        Not the right account? <Link href="/vendor/login">Sign in with another email</Link>.
      </div>
    </AuthShell>
  );
}
