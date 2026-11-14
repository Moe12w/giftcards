import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';

const STATUSES = [
  'draft',
  'pending_payment',
  'pending_approval',
  'scheduled',
  'active',
  'paused',
  'budget_exhausted',
  'completed',
  'rejected',
  'cancelled',
  'refunded',
];

export default async function AdminAdvertisingCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; placement?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const statusFilter = params.status ?? '';
  const query = (params.q ?? '').trim().toLowerCase();
  const placementFilter = params.placement ?? '';

  const [campaignsResult, placementsResult] = await Promise.all([
    ctx.supabase
      .from('advertising_campaigns')
      .select('*, advertising_placements(id,key,name), vendors(id,name), advertising_creatives(headline, image_url)')
      .order('created_at', { ascending: false })
      .limit(1000),
    ctx.supabase
      .from('advertising_placements')
      .select('id, key, name')
      .order('sort_order', { ascending: true }),
  ]);

  const placements = placementsResult.data ?? [];
  const campaigns = campaignsResult.data ?? [];
  const rows = campaigns.filter((campaign: any) => {
    if (statusFilter && campaign.status !== statusFilter) return false;
    if (placementFilter && campaign.placement_id !== placementFilter) return false;
    if (!query) return true;
    const haystack = `${campaign.name} ${campaign.campaign_ref} ${campaign.vendors?.name ?? ''} ${campaign.payment_reference ?? ''}`.toLowerCase();
    return haystack.includes(query);
  });

  const counts = STATUSES.reduce<Record<string, number>>((acc, status) => {
    acc[status] = campaigns.filter((campaign: any) => campaign.status === status).length;
    return acc;
  }, {});

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Advertising & promotions"
        title="Campaigns"
        description="Every advertiser campaign with its payment, approval, schedule, budget and delivery state."
        actions={
          <Link className="btn sm ghost" href="/admin/advertising">
            Advertising overview
          </Link>
        }
      />
      <Notice error={params.error ?? campaignsResult.error?.message} success={params.saved === '1' ? 'Saved.' : null} />

      <div className="pill-row">
        <Link className={`filter-chip${statusFilter === '' ? ' active' : ''}`} href="/admin/advertising/campaigns">
          All {campaigns.length}
        </Link>
        {STATUSES.map((status) => (
          <Link
            key={status}
            className={`filter-chip${statusFilter === status ? ' active' : ''}`}
            href={`/admin/advertising/campaigns?status=${status}`}
          >
            {status.replace(/_/g, ' ')} {counts[status] ?? 0}
          </Link>
        ))}
      </div>

      <form className="toolbar" action="/admin/advertising/campaigns" method="get">
        <input name="q" defaultValue={params.q ?? ''} placeholder="Search campaign, advertiser or reference" aria-label="Search" />
        <select name="status" defaultValue={statusFilter} aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <select name="placement" defaultValue={placementFilter} aria-label="Placement">
          <option value="">All placements</option>
          {placements.map((placement: any) => (
            <option key={placement.id} value={placement.id}>
              {placement.name}
            </option>
          ))}
        </select>
        <button className="btn sm" type="submit">Filter</button>
        {statusFilter || placementFilter || query ? (
          <Link className="btn sm ghost" href="/admin/advertising/campaigns">Clear</Link>
        ) : null}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title="No campaigns match"
          body="Try a different status or search term. Vendor campaigns appear here as soon as they are created."
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>{rows.length} campaigns</h3>
            <span className="small muted">Activation is always server-verified.</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Advertiser</th>
                    <th>Placement / model</th>
                    <th className="num">Quote</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Window</th>
                    <th className="num">Priority</th>
                    <th style={{ textAlign: 'right' }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((campaign: any) => (
                    <tr key={campaign.id}>
                      <td>
                        <span className="strong">{campaign.name}</span>
                        <div className="sub mono">{campaign.campaign_ref}</div>
                      </td>
                      <td>
                        {campaign.vendors?.name ?? '—'}
                        <div className="sub">{campaign.vendors?.id ? 'Vendor' : 'Platform'}</div>
                      </td>
                      <td>
                        <span className="small">{campaign.advertising_placements?.name ?? campaign.placement_key}</span>
                        <div className="sub">
                          {campaign.slot_number ? `Slot ${campaign.slot_number} · ` : ''}
                          {campaign.pricing_model.toUpperCase()}
                          {campaign.pricing_model === 'cpc' ? ` · ${formatMoney(campaign.cpc_rate_minor)}/click` : null}
                          {campaign.pricing_model === 'cpm' ? ` · ${formatMoney(campaign.cpm_rate_minor)}/1k` : null}
                        </div>
                      </td>
                      <td className="num">{formatMoney(campaign.quote_amount_minor)}</td>
                      <td>
                        <StatusTag status={campaign.payment_status} />
                        <div className="sub mono">{campaign.payment_reference ?? ''}</div>
                      </td>
                      <td>
                        <StatusTag status={campaign.status} />
                        {campaign.pause_reason ? <div className="sub">{campaign.pause_reason.replace(/_/g, ' ')}</div> : null}
                      </td>
                      <td className="small muted">
                        {formatDate(campaign.starts_at)} → {formatDate(campaign.ends_at)}
                      </td>
                      <td className="num">{campaign.priority}</td>
                      <td style={{ textAlign: 'right' }}>
                        <Link className="btn sm ghost" href={`/admin/advertising/campaigns/${campaign.id}`}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
