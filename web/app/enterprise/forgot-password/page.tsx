import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Send } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';
import { Notice } from '@/components/ui';
import { requestPasswordReset } from '@/lib/actions/auth';

export const metadata: Metadata = { title: 'Reset your enterprise password' };

export default async function EnterpriseForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell
      tone="lavender"
      eyebrow="Enterprise portal"
      title="Back to your codes and reports."
      description="We will email you a secure link to choose a new password."
    >
      <span className="eyebrow lavender">Password reset</span>
      <h1 style={{ marginTop: 14 }}>Forgot your password?</h1>
      <p style={{ marginTop: 10 }}>
        Enter the work email linked to your partner account.
      </p>
      <Notice
        error={params.error}
        success={
          params.sent === '1'
            ? 'If that email has an account, a reset link is on its way.'
            : null
        }
      />
      <form action={requestPasswordReset} className="form" style={{ marginTop: 20 }}>
        <input type="hidden" name="portal" value="enterprise" />
        <div className="field">
          <label htmlFor="email">Work email</label>
          <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
        </div>
        <button className="btn lavender block" type="submit">
          Send reset link <Send size={16} />
        </button>
      </form>
      <div className="auth-switch">
        <Link href="/enterprise/login">
          <ArrowLeft size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
