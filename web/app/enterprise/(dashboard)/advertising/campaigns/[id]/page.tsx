import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  CalendarRange,
  Copy,
  Eye,
  MousePointerClick,
  Pause,
  Pencil,
  Play,
  Receipt,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { requireAdvertiser } from '@/lib/auth';
import { formatDate, formatDateTime } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { Notice, PageHead, ReadRow, StatusTag } from '@/components/ui';
import {
  duplicateAdvertisingCampaign,
  pauseAdvertisingCampaign,
  renewAdvertisingCampaign,
  resumeAdvertisingCampaign,
} from '@/lib/actions/advertising';

const EDITABLE = ['draft', 'pending_payment', 'pending_approval', 'rejected', 'scheduled', 'paused'];

export default async function VendorAdvertisingCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; paused?: string; resumed?: string; paid?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const ctx = await requireAdvertiser({ prefer: 'enterprise' });

  const { data: campaign } = await ctx.supabase
    .from('advertising_campaigns')
    .select('*, advertising_placements(name,key,format), advertising_creatives(*)')
    .eq('id', id)
    .eq('vendor_id', ctx.vendor.id)
    .maybeSingle();

  if (!campaign) notFound();

  const [budgetResult, statsResult, transactionsResult, approvalsResult] = await Promise.all([
    ctx.supabase.from('advertising_campaign_budgets').select('*').eq('campaign_id', id).maybeSingle(),
    ctx.supabase.from('advertising_daily_stats').select('*').eq('campaign_id', id).order('stat_date', { ascending: false }),
    ctx.supabase
      .from('advertising_transactions')
      .select('*')
      .eq('campaign_id', id)
      .order('created_at', { ascending: false }),
    ctx.supabase
      .from('advertising_approvals')
      .select('*')
      .eq('campaign_id', id)
      .order('created_at', { ascending: false }),
  ]);

  const budget = budgetResult.data;
  const stats = statsResult.data ?? [];
  const transactions = transactionsResult.data ?? [];
  const approvals = approvalsResult.data ?? [];
  const creative = (campaign.advertising_creatives ?? [])[0];

  const impressions = stats.reduce((sum: number, row: any) => sum + Number(row.impressions ?? 0), 0);
  const clicks = stats.reduce((sum: number, row: any) => sum + Number(row.clicks ?? 0), 0);
  const conversions = stats.reduce((sum: number, row: any) => sum + Number(row.conversions ?? 0), 0);
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const totalBudget = Number(budget?.total_budget_minor ?? campaign.total_budget_minor ?? 0);
  const spent = Number(budget?.spent_minor ?? 0);
  const editable = EDITABLE.includes(campaign.status);
  const canPause = ['active', 'scheduled', 'pending_approval'].includes(campaign.status);
  const canResume = campaign.status === 'paused';
  const canRenew = ['active', 'completed', 'budget_exhausted'].includes(campaign.status);
  const unpaid = ['draft', 'pending_payment', 'rejected'].includes(campaign.status) && campaign.payment_status !== 'paid';

  return (
    <div className="dash-content">
      <Link className="back-link" href={ctx.home}>
        <ArrowLeft size={15} /> Advertising
      </Link>
      <PageHead
        eyebrow={campaign.campaign_ref}
        title={campaign.name}
        description={`${campaign.advertising_placements?.name ?? campaign.placement_key} · ${campaign.pricing_model.toUpperCase()}`}
        actions={
          <>
            {unpaid ? (
              <Link className="btn sm primary" href={`${ctx.home}/checkout/${campaign.id}`}>
                Checkout
              </Link>
            ) : null}
            {editable ? (
              <Link className="btn sm" href={`${ctx.home}/campaigns/${campaign.id}/edit`}>
                <Pencil size={15} /> Edit
              </Link>
            ) : null}
            {canPause ? (
              <form action={pauseAdvertisingCampaign}>
                <input type="hidden" name="campaign_id" value={campaign.id} />
                <button className="btn sm" type="submit">
                  <Pause size={15} /> Pause
                </button>
              </form>
            ) : null}
            {canResume ? (
              <form action={resumeAdvertisingCampaign}>
                <input type="hidden" name="campaign_id" value={campaign.id} />
                <button className="btn sm primary" type="submit">
                  <Play size={15} /> Resume
                </button>
              </form>
            ) : null}
          </>
        }
      />
      <Notice
        error={query.error}
        success={
          query.saved === '1'
            ? 'Campaign saved.'
            : query.paused === '1'
              ? 'Campaign paused.'
              : query.resumed === '1'
                ? 'Campaign resumed.'
                : query.paid === '1'
                  ? 'Payment verified. The campaign is now following the activation rules.'
                  : null
        }
      />

      <div className="pill-row">
        <StatusTag status={campaign.status} />
        <StatusTag status={campaign.payment_status} />
        {campaign.approved_at ? <span className="tag success">approved</span> : <span className="tag warning">not approved</span>}
        {campaign.auto_renew ? <span className="tag sky">auto-renew</span> : null}
        {campaign.pause_reason ? <span className="tag warning">{campaign.pause_reason.replace(/_/g, ' ')}</span> : null}
      </div>

      {campaign.status === 'pending_approval' ? (
        <div className="callout info">
          Payment is verified and the campaign is waiting for platform review. You will be notified when it is
          approved or rejected.
        </div>
      ) : null}
      {campaign.eligibility_reason ? (
        <div className="callout warn">Waiting: {campaign.eligibility_reason.replace(/_/g, ' ')}</div>
      ) : null}

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon"><Eye size={17} /></span>
          <strong>{impressions.toLocaleString('en-QA')}</strong>
          <span>Impressions</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--sky-soft)' }}><MousePointerClick size={17} /></span>
          <strong>{clicks.toLocaleString('en-QA')}</strong>
          <span>Clicks</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}><TrendingUp size={17} /></span>
          <strong>{ctr.toFixed(2)}%</strong>
          <span>CTR</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--coral-soft)' }}><Receipt size={17} /></span>
          <strong>{conversions.toLocaleString('en-QA')}</strong>
          <span>Conversions</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--lavender-soft)' }}><Wallet size={17} /></span>
          <strong>{formatMoney(spent)}</strong>
          <span>Spent of {formatMoney(totalBudget)}</span>
        </div>
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>
              <CalendarRange size={17} /> Schedule &amp; budget
            </h3>
          </div>
          <div className="panel-body">
            <div className="split-list">
              <ReadRow label="Starts" value={formatDateTime(campaign.starts_at)} />
              <ReadRow label="Ends" value={formatDateTime(campaign.ends_at)} />
              <ReadRow label="Pricing model" value={campaign.pricing_model.toUpperCase()} />
              <ReadRow
                label="Rate"
                value={
                  campaign.pricing_model === 'fixed'
                    ? formatMoney(campaign.fixed_price_minor)
                    : campaign.pricing_model === 'cpc'
                      ? `${formatMoney(campaign.cpc_rate_minor)} / click`
                      : `${formatMoney(campaign.cpm_rate_minor)} / 1,000 impressions`
                }
              />
              <ReadRow label="Total budget" value={formatMoney(totalBudget)} />
              <ReadRow
                label="Daily budget"
                value={budget && budget.daily_budget_minor > 0 ? formatMoney(budget.daily_budget_minor) : 'No daily cap'}
              />
              <ReadRow label="Spent" value={formatMoney(spent)} />
              <ReadRow label="Remaining" value={formatMoney(Math.max(0, totalBudget - spent))} />
              <ReadRow label="Payment reference" value={<span className="mono">{campaign.payment_reference ?? '—'}</span>} />
              <ReadRow label="Auto-renew" value={campaign.auto_renew ? 'Authorised' : 'Off'} />
            </div>
            <div className="progress" style={{ marginTop: 12 }}>
              <span style={{ width: `${totalBudget > 0 ? Math.min(100, (spent / totalBudget) * 100) : 0}%` }} />
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Creative</h3>
            {creative ? <StatusTag status={creative.status} /> : null}
          </div>
          <div className="panel-body">
            {creative ? (
              <div className="card flat" style={{ display: 'grid', gap: 8 }}>
                {creative.image_url ? (
                  <img
                    src={creative.mobile_image_url || creative.image_url}
                    alt={creative.image_alt ?? ''}
                    style={{ width: '100%', borderRadius: 12, aspectRatio: '2 / 1', objectFit: 'cover' }}
                  />
                ) : null}
                <span className="tag lavender">{creative.sponsored_label}</span>
                <strong style={{ fontSize: 18 }}>{creative.headline}</strong>
                {creative.body ? <p className="small">{creative.body}</p> : null}
                {creative.cta_label ? <span className="btn sm primary" style={{ width: 'fit-content' }}>{creative.cta_label}</span> : null}
                <span className="small muted">
                  Destination: {creative.destination_type}
                  {creative.destination_url ? ` · ${creative.destination_url}` : ''}
                </span>
              </div>
            ) : (
              <p className="muted small">No creative yet.</p>
            )}
          </div>
        </section>
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Manage</h3>
            <span className="small muted">Duplicating or renewing creates a new unpaid campaign.</span>
          </div>
          <div className="panel-body">
            <div className="row-actions" style={{ flexWrap: 'wrap' }}>
              <form action={duplicateAdvertisingCampaign}>
                <input type="hidden" name="campaign_id" value={campaign.id} />
                <button className="btn sm" type="submit">
                  <Copy size={15} /> Duplicate
                </button>
              </form>
              {canRenew ? (
                <form action={renewAdvertisingCampaign}>
                  <input type="hidden" name="campaign_id" value={campaign.id} />
                  <button className="btn sm primary" type="submit">
                    <RefreshCw size={15} /> Renew
                  </button>
                </form>
              ) : null}
              {unpaid ? (
                <Link className="btn sm primary" href={`${ctx.home}/checkout/${campaign.id}`}>
                  <Receipt size={15} /> Go to checkout
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Approval history</h3>
            <span className="small muted">{approvals.length} reviews</span>
          </div>
          <div className="panel-body">
            {approvals.length === 0 ? (
              <p className="muted small">No review has been recorded yet.</p>
            ) : (
              <div className="timeline">
                {approvals.map((approval: any) => (
                  <div className="timeline-item" key={approval.id}>
                    <span className="timeline-dot" />
                    <div>
                      <strong>{approval.status}</strong>
                      <div className="sub">{formatDateTime(approval.reviewed_at ?? approval.created_at)}</div>
                      {approval.note ? <p className="small">{approval.note}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>Billing history</h3>
          <span className="small muted">Advertising ledger only</span>
        </div>
        <div className="panel-body flush">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Kind</th>
                  <th>Status</th>
                  <th className="num">Amount</th>
                  <th>Reference</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted small">No billing entries yet.</td>
                  </tr>
                ) : (
                  transactions.map((transaction: any) => (
                    <tr key={transaction.id}>
                      <td><span className="tag neutral">{transaction.kind.replace(/_/g, ' ')}</span></td>
                      <td><StatusTag status={transaction.status} /></td>
                      <td className="num">{formatMoney(transaction.amount_minor)}</td>
                      <td className="small mono">{transaction.provider_reference ?? '—'}</td>
                      <td className="small muted">{formatDateTime(transaction.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>Daily delivery</h3>
          <span className="small muted">Impressions, clicks, conversions and spend</span>
        </div>
        <div className="panel-body flush">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="num">Impressions</th>
                  <th className="num">Clicks</th>
                  <th className="num">CTR</th>
                  <th className="num">Conversions</th>
                  <th className="num">Spend</th>
                </tr>
              </thead>
              <tbody>
                {stats.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted small">No delivery has been recorded yet.</td>
                  </tr>
                ) : (
                  stats.map((row: any) => (
                    <tr key={row.stat_date}>
                      <td>{formatDate(row.stat_date)}</td>
                      <td className="num">{Number(row.impressions).toLocaleString('en-QA')}</td>
                      <td className="num">{Number(row.clicks).toLocaleString('en-QA')}</td>
                      <td className="num">
                        {Number(row.impressions) > 0
                          ? `${((Number(row.clicks) / Number(row.impressions)) * 100).toFixed(2)}%`
                          : '—'}
                      </td>
                      <td className="num">{Number(row.conversions).toLocaleString('en-QA')}</td>
                      <td className="num">{formatMoney(row.spend_minor)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
