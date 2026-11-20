import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BadgeCheck, Clock3, ShieldAlert, XCircle } from 'lucide-react';
import { getBusinessBuyerContext } from '@/lib/auth';
import { Notice, PageHead } from '@/components/ui';

export const metadata: Metadata = { title: 'Business account status' };

const copy: Record<string, { title: string; body: string; tone: string }> = {
  pending_approval: {
    title: 'Your business account is pending approval',
    body: 'Thanks for registering. Our team will review your company details. Once approved, you will be able to access exclusive bulk deals and corporate pricing.',
    tone: 'info',
  },
  rejected: {
    title: 'Your business account was not approved',
    body: 'Your registration was reviewed but not approved at this time. If you believe this is a mistake, please contact our team and we can help.',
    tone: 'error',
  },
  suspended: {
    title: 'Your business account is suspended',
    body: 'Access to bulk purchasing is currently suspended for this account. Please contact support if you need assistance.',
    tone: 'error',
  },
  approved: {
    title: 'Your business account is approved',
    body: 'You can now browse bulk deals and place corporate orders.',
    tone: 'info',
  },
};

export default async function BusinessStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; submitted?: string }>;
}) {
  const params = await searchParams;
  const ctx = await getBusinessBuyerContext();
  if (!ctx) redirect('/business/login');
  if (!ctx.account) redirect('/business/register');

  const status = params.status || ctx.account.status;
  if (status === 'approved') redirect('/business');

  const info = copy[status] ?? copy.pending_approval;
  const Icon = status === 'rejected' ? XCircle : status === 'suspended' ? ShieldAlert : status === 'approved' ? BadgeCheck : Clock3;

  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 760 }}>
        <PageHead eyebrow="Business / Bulk Buyer" title={info.title} description={info.body} />
        <Notice success={params.submitted === '1' ? 'Your business registration has been submitted for approval.' : null} />
        <div className="card" style={{ padding: 24, marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span className="icon-tile lavender"><Icon size={22} /></span>
            <div>
              <p className="strong" style={{ marginBottom: 6 }}>Company: {ctx.account.company_name}</p>
              <p className="small muted">Status: {ctx.account.status.replace(/_/g, ' ')}</p>
              {ctx.account.decision_note ? <p className="small" style={{ marginTop: 8 }}>Note: {ctx.account.decision_note}</p> : null}
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: 20 }}>
            <Link className="btn" href="/">Back to site</Link>
            <Link className="btn ghost" href="/contact">Contact support</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
