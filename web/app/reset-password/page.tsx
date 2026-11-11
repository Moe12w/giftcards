import type { Metadata } from 'next';
import Link from 'next/link';
import { updatePassword } from '@/lib/actions/auth';
import { Logo } from '@/components/Logo';

export const metadata: Metadata = { title: 'Set a new password' };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const params = await searchParams;
  const done = params.done === '1';
  const error =
    params.error === 'link'
      ? 'That reset link is invalid or has expired. Request a new one from your sign-in page.'
      : null;

  return (
    <div className="auth-shell">
      <div className="auth-side lavender">
        <Logo />
        <div>
          <h2>Back into your account, safely.</h2>
          <p>Choose a new password with at least eight characters. You will stay signed in on this device.</p>
        </div>
        <p className="small">Giftly · Doha, Qatar</p>
      </div>
      <div className="auth-main">
        <div className="auth-card">
          <span className="eyebrow lavender">Password reset</span>
          <h1 style={{ marginTop: 14 }}>{done ? 'Password updated' : 'Choose a new password'}</h1>
          {done ? (
            <>
              <p style={{ marginTop: 12 }}>
                Your password has been changed. You can now open the dashboard you use.
              </p>
              <div className="form">
                <Link className="btn primary block" href="/vendor">
                  Vendor dashboard
                </Link>
                <Link className="btn block" href="/enterprise">
                  Enterprise dashboard
                </Link>
                <Link className="btn block" href="/admin">
                  Admin dashboard
                </Link>
              </div>
            </>
          ) : (
            <>
              <p style={{ marginTop: 12 }}>
                Pick something you have not used before. Eight characters minimum.
              </p>
              {error ? <div className="callout error" style={{ marginTop: 16 }}>{error}</div> : null}
              {params.error && !error ? (
                <div className="callout error" style={{ marginTop: 16 }}>
                  Could not update your password. Open the reset link from your email again.
                </div>
              ) : null}
              <form action={updatePassword} className="form">
                <div className="field">
                  <label htmlFor="password">New password</label>
                  <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
                </div>
                <div className="field">
                  <label htmlFor="confirm">Confirm password</label>
                  <input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
                </div>
                <button className="btn primary block" type="submit">
                  Update password
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
