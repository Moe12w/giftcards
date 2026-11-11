import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Send } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';
import { Notice } from '@/components/ui';
import { requestPasswordReset } from '@/lib/actions/auth';

export const metadata: Metadata = { title: 'Reset your admin password' };

export default async function AdminForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell
      tone="coral"
      eyebrow="Platform admin"
      title="Secure access, restored."
      description="We will email you a secure link to choose a new password."
    >
      <span className="eyebrow coral">Password reset</span>
      <h1 style={{ marginTop: 14 }}>Forgot your password?</h1>
      <p style={{ marginTop: 10 }}>Enter your admin email address.</p>
      <Notice
        error={params.error}
        success={
          params.sent === '1'
            ? 'If that email has an account, a reset link is on its way.'
            : null
        }
      />
      <form action={requestPasswordReset} className="form" style={{ marginTop: 20 }}>
        <input type="hidden" name="portal" value="admin" />
        <div className="field">
          <label htmlFor="email">Admin email</label>
          <input id="email" name="email" type="email" autoComplete="email" required placeholder="admin@giftly.qa" />
        </div>
        <button className="btn coral block" type="submit">
          Send reset link <Send size={16} />
        </button>
      </form>
      <div className="auth-switch">
        <Link href="/admin/login">
          <ArrowLeft size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
