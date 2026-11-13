import Link from 'next/link';
import { Ban, BadgeCheck, Wallet } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';
import { adminGrantAdvertisingCredit, adminSetAdvertiserStatus } from '@/lib/actions/advertising';

export default async function AdminAdvertisersPage({
  searchParams,
}: {
  searchParams: Promise<{ vendor?: string; saved?: string; credited?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();

  const [vendorsResult, campaignsResult, creditsResult, transactionsResult] = await Promise.all([
    ctx.supabase
      .from('vendors')
      .select('id, name, slug, status, advertising_enabled, advertising_verified, advertising_suspended_at, advertising_suspended_reason, created_at')
      .order('name', { ascending: true })
      .limit(500),
    ctx.supabase
      .from('advertising_campaigns')
      .select('id, vendor_id, status, quote_amount_minor, payment_status, created_at')
      .limit(2000),
    ctx.supabase
      .from('advertising_promotional_credits')
      .select('vendor_id, remaining_minor, status, expires_at')
      .limit(2000),
    ctx.supabase
      .from('advertising_transactions')
      .select('vendor_id, kind, status, amount_minor')
      .eq('status', 'succeeded')
      .limit(5000),
  ]);

  const vendors = vendorsResult.data ?? [];
  const campaigns = campaignsResult.data ?? [];
  const credits = creditsResult.data ?? [];
  const transactions = transactionsResult.data ?? [];

  const selected = params.vendor ? vendors.find((vendor: any) => vendor.id === params.vendor) : null;

  function statsFor(vendorId: string) {
    const vendorCampaigns = campaigns.filter((campaign: any) => campaign.vendor_id === vendorId);
    const active = vendorCampaigns.filter((campaign: any) => campaign.status === 'active').length;
    const pending = vendorCampaigns.filter((campaign: any) =>
      ['pending_payment', 'pending_approval'].includes(campaign.status),
    ).length;
    const spend = transactions
      .filter((transaction: any) => transaction.vendor_id === vendorId && transaction.kind === 'payment')
      .reduce((sum: number, transaction: any) => sum + Number(transaction.amount_minor ?? 0), 0);
    const credit = credits
      .filter((row: any) => row.vendor_id === vendorId && row.status === 'available')
      .reduce((sum: number, row: any) => sum + Number(row.remaining_minor ?? 0), 0);
    return { total: vendorCampaigns.length, active, pending, spend, credit };
  }

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Advertising & promotions"
        title="Advertisers"
        description="Advertising privileges are separate from the vendor account: suspending ad access pauses campaigns without suspending the business."
      />
      <Notice
        error={params.error}
        success={
          params.saved === '1'
            ? 'Advertiser status saved.'
            : params.credited === '1'
              ? 'Advertising credit granted.'
              : null
        }
      />

      {selected ? (
        <div className="dash-grid">
          <section className="panel">
            <div className="panel-head">
              <h3>{selected.name}</h3>
              <StatusTag status={selected.status} />
            </div>
            <div className="panel-body">
              <form action={adminSetAdvertiserStatus} style={{ display: 'grid', gap: 12 }}>
                <input type="hidden" name="vendor_id" value={selected.id} />
                <label className="checkbox-row">
                  <input type="checkbox" name="enabled" defaultChecked={selected.advertising_enabled} />
                  Advertising enabled
                </label>
                <div className="field">
                  <label htmlFor="reason">Suspension reason</label>
                  <input
                    id="reason"
                    name="reason"
                    defaultValue={selected.advertising_suspended_reason ?? ''}
                    placeholder="Policy breach, unpaid balance, request from the advertiser…"
                  />
                  <span className="hint">Only used when advertising is disabled. The vendor account itself stays active.</span>
                </div>
                <button className="btn primary" type="submit">Save advertiser status</button>
              </form>
              {selected.advertising_suspended_at ? (
                <p className="small muted" style={{ marginTop: 10 }}>
                  Suspended {formatDate(selected.advertising_suspended_at)}
                </p>
              ) : null}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Grant advertising credit</h3>
              <Wallet size={17} />
            </div>
            <div className="panel-body">
              <form action={adminGrantAdvertisingCredit} style={{ display: 'grid', gap: 12 }}>
                <input type="hidden" name="vendor_id" value={selected.id} />
                <div className="field">
                  <label htmlFor="amount">Amount (QAR)</label>
                  <input id="amount" name="amount" inputMode="decimal" required />
                </div>
                <div className="field">
                  <label htmlFor="expires_at">Expires on (optional)</label>
                  <input id="expires_at" name="expires_at" type="date" />
                </div>
                <div className="field">
                  <label htmlFor="note">Note</label>
                  <input id="note" name="note" placeholder="Goodwill, campaign make-good, launch offer…" />
                </div>
                <button className="btn" type="submit">
                  <Wallet size={15} /> Grant credit
                </button>
              </form>
            </div>
          </section>
        </div>
      ) : null}

      {vendors.length === 0 ? (
        <EmptyState title="No vendors yet" body="Approved vendors can advertise once they create a campaign." />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>Advertiser accounts</h3>
            <span className="small muted">Ad revenue is tracked separately from gift-card sales.</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Advertiser</th>
                    <th>Vendor status</th>
                    <th>Ad privileges</th>
                    <th className="num">Campaigns</th>
                    <th className="num">Live / pending</th>
                    <th className="num">Paid spend</th>
                    <th className="num">Available credit</th>
                    <th style={{ textAlign: 'right' }} />
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((vendor: any) => {
                    const stats = statsFor(vendor.id);
                    return (
                      <tr key={vendor.id}>
                        <td>
                          <span className="strong">{vendor.name}</span>
                          <div className="sub">{vendor.slug ?? vendor.id}</div>
                        </td>
                        <td><StatusTag status={vendor.status} /></td>
                        <td>
                          {vendor.advertising_enabled ? (
                            <span className="tag success"><BadgeCheck size={13} /> enabled</span>
                          ) : (
                            <span className="tag danger"><Ban size={13} /> suspended</span>
                          )}
                          {!vendor.advertising_enabled && vendor.advertising_suspended_reason ? (
                            <div className="sub">{vendor.advertising_suspended_reason}</div>
                          ) : null}
                        </td>
                        <td className="num">{stats.total}</td>
                        <td className="num">{stats.active} / {stats.pending}</td>
                        <td className="num">{formatMoney(stats.spend)}</td>
                        <td className="num">{formatMoney(stats.credit)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <Link className="btn sm ghost" href={`/admin/advertising/advertisers?vendor=${vendor.id}`}>
                            Manage
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
