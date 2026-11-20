import Link from 'next/link';
import {
  ArrowRight,
  BadgeDollarSign,
  Clock,
  Eye,
  Megaphone,
  MousePointerClick,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { EmptyState, Kpi, Notice, PageHead, StatusTag } from '@/components/ui';
import { AdvertisingTutorialButton } from '@/components/AdvertisingTutorialButton';
import { adminRunAdvertisingMaintenance } from '@/lib/actions/advertising';
import { getUserLocale } from '@/lib/i18n/server';

export default async function AdminAdvertisingPage({
  searchParams,
}: {
  searchParams: Promise<{ maintenance?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const locale = await getUserLocale(ctx.profile?.preferred_language);

  const [campaignsResult, transactionsResult, statsResult, placementsResult, pendingResult] =
    await Promise.all([
      ctx.supabase
        .from('advertising_campaigns')
        .select('*, advertising_placements(key,name), vendors(name), advertising_creatives(headline, image_url)')
        .order('created_at', { ascending: false })
        .limit(500),
      ctx.supabase
        .from('advertising_transactions')
        .select('id, campaign_id, vendor_id, kind, status, amount_minor, currency, provider, provider_reference, created_at')
        .order('created_at', { ascending: false })
        .limit(2000),
      ctx.supabase
        .from('advertising_daily_stats')
        .select('campaign_id, impressions, clicks, conversions, spend_minor')
        .limit(10000),
      ctx.supabase
        .from('advertising_placements')
        .select('*, advertising_pricing(*)')
        .order('sort_order', { ascending: true }),
      ctx.supabase
        .from('advertising_campaigns')
        .select('id, name, vendor_id, quote_amount_minor, submitted_at, vendors(name)')
        .eq('status', 'pending_approval')
        .order('submitted_at', { ascending: true })
        .limit(20),
    ]);

  const campaigns = campaignsResult.data ?? [];
  const transactions = transactionsResult.data ?? [];
  const stats = statsResult.data ?? [];
  const placements = placementsResult.data ?? [];
  const pending = pendingResult.data ?? [];

  const paid = transactions.filter((t: any) => t.kind === 'payment' && t.status === 'succeeded');
  const refunds = transactions.filter((t: any) => t.kind === 'refund' && t.status === 'succeeded');
  const gross = paid.reduce((sum: number, t: any) => sum + Number(t.amount_minor ?? 0), 0);
  const refunded = refunds.reduce((sum: number, t: any) => sum + Number(t.amount_minor ?? 0), 0);
  const net = gross - refunded;

  const impressions = stats.reduce((sum: number, s: any) => sum + Number(s.impressions ?? 0), 0);
  const clicks = stats.reduce((sum: number, s: any) => sum + Number(s.clicks ?? 0), 0);
  const conversions = stats.reduce((sum: number, s: any) => sum + Number(s.conversions ?? 0), 0);
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

  const active = campaigns.filter((c: any) => c.status === 'active');
  const scheduled = campaigns.filter((c: any) => c.status === 'scheduled');
  const awaiting = campaigns.filter((c: any) => c.status === 'pending_approval' || c.status === 'pending_payment');
  const liveVendors = new Set(active.map((c: any) => c.vendor_id).filter(Boolean));

  // Revenue split by placement and model, based on verified payments only.
  const split = new Map<string, { placement: string; model: string; count: number; revenue: number }>();
  for (const campaign of campaigns as any[]) {
    if (campaign.payment_status !== 'paid') continue;
    const key = `${campaign.placement_key}:${campaign.pricing_model}`;
    const current = split.get(key) ?? {
      placement: campaign.advertising_placements?.name ?? campaign.placement_key,
      model: campaign.pricing_model,
      count: 0,
      revenue: 0,
    };
    current.count += 1;
    current.revenue += Number(campaign.quote_amount_minor ?? 0);
    split.set(key, current);
  }
  const splitRows = [...split.values()].sort((a, b) => b.revenue - a.revenue);
  const topRevenue = splitRows[0]?.revenue ?? 1;

  const recent = campaigns.slice(0, 8);

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Advertising & promotions"
        title="Advertising overview"
        description="Verified advertising revenue, delivery performance, pending approvals and placement health — separate from gift-card finance."
        actions={
          <>
            <AdvertisingTutorialButton portal="admin" locale={locale} />
            <form action={adminRunAdvertisingMaintenance}>
              <button className="btn sm" type="submit">
                <RefreshCw size={15} /> Run lifecycle
              </button>
            </form>
            <Link className="btn sm primary" href="/admin/advertising/placements">
              Placements &amp; pricing <ArrowRight size={15} />
            </Link>
          </>
        }
      />
      <Notice
        error={params.error ?? campaignsResult.error?.message ?? transactionsResult.error?.message}
        success={params.maintenance === '1' ? 'Lifecycle maintenance ran. Scheduled campaigns, budgets and expiries are up to date.' : null}
      />

      <div className="kpi-grid">
        <Kpi
          label="Net advertising revenue"
          value={formatMoney(net)}
          hint={`${formatMoney(gross)} paid, ${formatMoney(refunded)} refunded`}
          tone="mint"
          icon={<BadgeDollarSign size={17} />}
        />
        <Kpi
          label="Live campaigns"
          value={String(active.length)}
          hint={`${scheduled.length} scheduled · ${liveVendors.size} advertisers live`}
          tone="lavender"
          icon={<Megaphone size={17} />}
        />
        <Kpi
          label="Awaiting action"
          value={String(awaiting.length)}
          hint={`${pending.length} paid, waiting for review`}
          tone="coral"
          icon={<Clock size={17} />}
        />
        <Kpi
          label="Impressions"
          value={impressions.toLocaleString('en-QA')}
          hint={`${clicks.toLocaleString('en-QA')} clicks · ${ctr.toFixed(2)}% CTR`}
          tone="sky"
          icon={<Eye size={17} />}
        />
        <Kpi
          label="Conversions"
          value={conversions.toLocaleString('en-QA')}
          hint="Attributed inside the configured window"
          tone="gold"
          icon={<TrendingUp size={17} />}
        />
        <Kpi
          label="Clicks"
          value={clicks.toLocaleString('en-QA')}
          hint="Deduplicated per person, 24 hours"
          tone="sky"
          icon={<MousePointerClick size={17} />}
        />
      </div>

      {pending.length > 0 ? (
        <section className="panel">
          <div className="panel-head">
            <h3>
              <ShieldCheck size={17} /> Paid campaigns waiting for approval
            </h3>
            <Link className="btn sm" href="/admin/advertising/campaigns?status=pending_approval">
              Review all
            </Link>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Advertiser</th>
                    <th className="num">Paid</th>
                    <th>Submitted</th>
                    <th style={{ textAlign: 'right' }}>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((campaign: any) => (
                    <tr key={campaign.id}>
                      <td>
                        <span className="strong">{campaign.name}</span>
                      </td>
                      <td>{campaign.vendors?.name ?? '—'}</td>
                      <td className="num">{formatMoney(campaign.quote_amount_minor)}</td>
                      <td className="small muted">{formatDate(campaign.submitted_at)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <Link className="btn sm primary" href={`/admin/advertising/campaigns/${campaign.id}`}>
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
      ) : null}

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Revenue by placement &amp; model</h3>
            <span className="small muted">Verified payments only</span>
          </div>
          <div className="panel-body">
            {splitRows.length === 0 ? (
              <p className="muted small">No advertising payments have been verified yet.</p>
            ) : (
              <div className="split-list">
                {splitRows.map((row) => (
                  <div key={`${row.placement}-${row.model}`} className="mini-row">
                    <div style={{ minWidth: 0 }}>
                      <span className="strong">{row.placement}</span>
                      <div className="small muted">
                        {row.model.toUpperCase()} · {row.count} campaign{row.count === 1 ? '' : 's'}
                      </div>
                      <div className="progress" style={{ marginTop: 6 }}>
                        <span style={{ width: `${Math.max(4, (row.revenue / topRevenue) * 100)}%` }} />
                      </div>
                    </div>
                    <span className="strong">{formatMoney(row.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Inventory health</h3>
            <Link className="btn sm ghost" href="/admin/advertising/placements">
              Manage
            </Link>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Placement</th>
                    <th className="num">Live</th>
                    <th className="num">Capacity</th>
                    <th>Rotation</th>
                  </tr>
                </thead>
                <tbody>
                  {placements.map((placement: any) => {
                    const live = active.filter((c: any) => c.placement_id === placement.id).length;
                    const capacity = placement.slot_count > 0
                      ? `${placement.slot_count} slots`
                      : placement.max_active_campaigns > 0
                        ? String(placement.max_active_campaigns)
                        : 'Unlimited';
                    return (
                      <tr key={placement.id}>
                        <td>
                          <span className="strong">{placement.name}</span>
                          <div className="sub mono">{placement.key}</div>
                        </td>
                        <td className="num">{live}</td>
                        <td className="num">{capacity}</td>
                        <td>
                          <StatusTag status={placement.is_active ? 'active' : 'paused'} />
                          <div className="sub">{placement.rotation_mode}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>Recent campaigns</h3>
          <Link className="btn sm ghost" href="/admin/advertising/campaigns">
            All campaigns
          </Link>
        </div>
        <div className="panel-body flush">
          {recent.length === 0 ? (
            <EmptyState
              title="No advertising campaigns yet"
              body="Vendor campaigns appear here as soon as they are created."
            />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Advertiser</th>
                    <th>Placement</th>
                    <th>Model</th>
                    <th className="num">Value</th>
                    <th>Status</th>
                    <th>Window</th>
                    <th style={{ textAlign: 'right' }} />
                  </tr>
                </thead>
                <tbody>
                  {recent.map((campaign: any) => (
                    <tr key={campaign.id}>
                      <td>
                        <span className="strong">{campaign.name}</span>
                        <div className="sub mono">{campaign.campaign_ref}</div>
                      </td>
                      <td>{campaign.vendors?.name ?? '—'}</td>
                      <td className="small">{campaign.advertising_placements?.name ?? campaign.placement_key}</td>
                      <td>
                        <span className="tag neutral">{campaign.pricing_model.toUpperCase()}</span>
                      </td>
                      <td className="num">{formatMoney(campaign.quote_amount_minor)}</td>
                      <td>
                        <StatusTag status={campaign.status} />
                        <div className="sub">{campaign.payment_status}</div>
                      </td>
                      <td className="small muted">
                        {formatDate(campaign.starts_at)} → {formatDate(campaign.ends_at)}
                      </td>
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
          )}
        </div>
      </section>
    </div>
  );
}
