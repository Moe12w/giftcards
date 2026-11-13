import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  BadgeDollarSign,
  Ban,
  CalendarPlus,
  Eye,
  Megaphone,
  MousePointerClick,
  Pause,
  Play,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Star,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { formatDate, formatDateTime } from '@/lib/format';
import { formatMoney, minorToInput } from '@/lib/money';
import { Notice, PageHead, ReadRow, StatusTag } from '@/components/ui';
import {
  adminGrantAdvertisingCredit,
  adminOverrideAdvertisingCampaign,
  adminReviewAdvertisingCampaign,
  adminVerifyAdvertisingPayment,
} from '@/lib/actions/advertising';

function toLocalInput(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function AdminAdvertisingCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ verified?: string; reviewed?: string; override?: string; credited?: string; saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const ctx = await requireAdmin();

  const { data: campaign } = await ctx.supabase
    .from('advertising_campaigns')
    .select('*, advertising_placements(*), vendors(id,name,status,is_featured,advertising_enabled,advertising_suspended_reason)')
    .eq('id', id)
    .maybeSingle();

  if (!campaign) notFound();

  const [creativeResult, budgetResult, statsResult, transactionsResult, ledgerResult, approvalsResult, auditResult] =
    await Promise.all([
      ctx.supabase
        .from('advertising_creatives')
        .select('*')
        .eq('campaign_id', id)
        .order('sort_order', { ascending: true }),
      ctx.supabase.from('advertising_campaign_budgets').select('*').eq('campaign_id', id).maybeSingle(),
      ctx.supabase.from('advertising_daily_stats').select('*').eq('campaign_id', id).order('stat_date', { ascending: false }),
      ctx.supabase
        .from('advertising_transactions')
        .select('*')
        .eq('campaign_id', id)
        .order('created_at', { ascending: false }),
      ctx.supabase
        .from('advertising_ledger_entries')
        .select('*')
        .eq('campaign_id', id)
        .order('created_at', { ascending: false }),
      ctx.supabase
        .from('advertising_approvals')
        .select('*')
        .eq('campaign_id', id)
        .order('created_at', { ascending: false }),
      ctx.supabase
        .from('advertising_audit_logs')
        .select('*')
        .eq('entity_type', 'advertising_campaign')
        .eq('entity_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

  const creatives = creativeResult.data ?? [];
  const budget = budgetResult.data;
  const stats = statsResult.data ?? [];
  const transactions = transactionsResult.data ?? [];
  const ledger = ledgerResult.data ?? [];
  const approvals = approvalsResult.data ?? [];
  const audit = auditResult.data ?? [];

  const impressions = stats.reduce((sum: number, row: any) => sum + Number(row.impressions ?? 0), 0);
  const clicks = stats.reduce((sum: number, row: any) => sum + Number(row.clicks ?? 0), 0);
  const conversions = stats.reduce((sum: number, row: any) => sum + Number(row.conversions ?? 0), 0);
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const spent = Number(budget?.spent_minor ?? 0);
  const totalBudget = Number(budget?.total_budget_minor ?? campaign.total_budget_minor ?? 0);
  const remaining = Math.max(0, totalBudget - spent);

  const paid = campaign.payment_status === 'paid';
  const canReview = campaign.status === 'pending_approval';
  const canPause = ['active', 'scheduled', 'pending_approval'].includes(campaign.status);
  const canResume = campaign.status === 'paused';
  const creative = creatives[0];

  return (
    <div className="dash-content">
      <Link className="back-link" href="/admin/advertising/campaigns">
        <ArrowLeft size={15} /> All campaigns
      </Link>

      <PageHead
        eyebrow={campaign.campaign_ref}
        title={campaign.name}
        description={`${campaign.advertising_placements?.name ?? campaign.placement_key} · ${campaign.pricing_model.toUpperCase()} · ${campaign.vendors?.name ?? 'Platform campaign'}`}
        actions={
          <>
            <Link className="btn sm ghost" href={`/admin/advertising/advertisers?vendor=${campaign.vendor_id ?? ''}`}>
              Advertiser
            </Link>
            {canPause ? (
              <form action={adminOverrideAdvertisingCampaign}>
                <input type="hidden" name="campaign_id" value={campaign.id} />
                <input type="hidden" name="override_action" value="pause" />
                <button className="btn sm" type="submit">
                  <Pause size={15} /> Pause
                </button>
              </form>
            ) : null}
            {canResume ? (
              <form action={adminOverrideAdvertisingCampaign}>
                <input type="hidden" name="campaign_id" value={campaign.id} />
                <input type="hidden" name="override_action" value="resume" />
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
          query.verified === '1'
            ? 'Payment verified. The campaign moved through approval and activation automatically.'
            : query.reviewed === '1'
              ? 'Review recorded.'
              : query.override === '1'
                ? 'Override applied.'
                : query.saved === '1'
                  ? 'Saved.'
                  : null
        }
      />

      <div className="pill-row">
        <StatusTag status={campaign.status} />
        <StatusTag status={campaign.payment_status} />
        {campaign.approved_at ? <span className="tag success">approved</span> : <span className="tag warning">not approved</span>}
        {campaign.capacity_override ? <span className="tag lavender">capacity override</span> : null}
        {campaign.auto_renew ? <span className="tag sky">auto-renew authorised</span> : null}
        {campaign.pause_reason ? <span className="tag warning">{campaign.pause_reason.replace(/_/g, ' ')}</span> : null}
      </div>

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
          <span className="kpi-icon" style={{ background: 'var(--coral-soft)' }}><BadgeDollarSign size={17} /></span>
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
            <h3>Campaign terms</h3>
            <span className="small muted">Pricing snapshot is frozen at purchase.</span>
          </div>
          <div className="panel-body">
            <div className="split-list">
              <ReadRow label="Advertiser" value={campaign.vendors?.name ?? 'Platform'} />
              <ReadRow label="Placement" value={campaign.advertising_placements?.name ?? campaign.placement_key} />
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
              <ReadRow label="Quote" value={formatMoney(campaign.quote_amount_minor)} />
              <ReadRow label="Starts" value={formatDateTime(campaign.starts_at)} />
              <ReadRow label="Ends" value={formatDateTime(campaign.ends_at)} />
              <ReadRow label="Priority / weight" value={`${campaign.priority} / ${campaign.rotation_weight}`} />
              <ReadRow
                label="Frequency cap"
                value={
                  campaign.frequency_cap_impressions > 0
                    ? `${campaign.frequency_cap_impressions} per ${campaign.frequency_cap_window_minutes || 60} min`
                    : 'Default rule'
                }
              />
              <ReadRow label="Payment reference" value={<span className="mono">{campaign.payment_reference ?? '—'}</span>} />
              <ReadRow label="Payment provider" value={campaign.payment_provider ?? '—'} />
              <ReadRow label="Renewals" value={`${campaign.renewal_count}${campaign.renewed_from_campaign_id ? ' · renewed' : ''}`} />
              <ReadRow label="Eligibility note" value={campaign.eligibility_reason ?? '—'} />
              <ReadRow label="Created" value={formatDateTime(campaign.created_at)} />
            </div>
            {budget ? (
              <>
                <div className="divider" />
                <div className="mini-row">
                  <span className="small muted">Budget consumed</span>
                  <span className="strong">
                    {formatMoney(spent)} / {formatMoney(totalBudget)}
                  </span>
                </div>
                <div className="progress">
                  <span style={{ width: `${totalBudget > 0 ? Math.min(100, (spent / totalBudget) * 100) : 0}%` }} />
                </div>
                <div className="mini-row" style={{ marginTop: 8 }}>
                  <span className="small muted">Daily budget</span>
                  <span>
                    {formatMoney(budget.daily_spent_minor)} / {budget.daily_budget_minor > 0 ? formatMoney(budget.daily_budget_minor) : 'Unlimited'}
                  </span>
                </div>
                <div className="mini-row">
                  <span className="small muted">Remaining</span>
                  <span>{formatMoney(remaining)}</span>
                </div>
              </>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Creative preview</h3>
            {creative ? <StatusTag status={creative.status} /> : null}
          </div>
          <div className="panel-body">
            {creative ? (
              <div className="card flat" style={{ display: 'grid', gap: 10 }}>
                {creative.image_url ? (
                  <img
                    src={creative.mobile_image_url || creative.image_url}
                    alt={creative.image_alt ?? ''}
                    style={{ width: '100%', borderRadius: 12, aspectRatio: '2 / 1', objectFit: 'cover' }}
                  />
                ) : null}
                <span className="tag lavender">{creative.sponsored_label}</span>
                <strong style={{ fontSize: 18 }}>{creative.headline}</strong>
                {creative.headline_ar ? (
                  <span dir="rtl" className="small muted">
                    {creative.headline_ar}
                  </span>
                ) : null}
                {creative.body ? <p className="small">{creative.body}</p> : null}
                {creative.cta_label ? <span className="btn sm primary" style={{ width: 'fit-content' }}>{creative.cta_label}</span> : null}
                <div className="small muted">
                  Destination: {creative.destination_type}
                  {creative.destination_url ? ` · ${creative.destination_url}` : ''}
                  {creative.destination_id ? ` · ${creative.destination_id}` : ''}
                </div>
                {creative.rejection_note ? <div className="callout error">{creative.rejection_note}</div> : null}
              </div>
            ) : (
              <p className="muted small">No creative has been attached to this campaign.</p>
            )}
          </div>
        </section>
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>
              <Receipt size={17} /> Payment verification
            </h3>
            <span className="small muted">Server-side only</span>
          </div>
          <div className="panel-body">
            {paid ? (
              <div className="callout info">
                Payment is verified. Reference <span className="mono">{campaign.payment_reference ?? '—'}</span>.
              </div>
            ) : (
              <form action={adminVerifyAdvertisingPayment} style={{ display: 'grid', gap: 12 }}>
                <input type="hidden" name="campaign_id" value={campaign.id} />
                <div className="field">
                  <label htmlFor="provider_reference">Provider / bank reference</label>
                  <input id="provider_reference" name="provider_reference" required defaultValue={campaign.payment_reference ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="amount">Amount received (QAR)</label>
                  <input id="amount" name="amount" inputMode="decimal" defaultValue={minorToInput(campaign.quote_amount_minor)} required />
                  <span className="hint">Must be at least the campaign quote.</span>
                </div>
                <button className="btn primary" type="submit">
                  <ShieldCheck size={15} /> Verify payment
                </button>
              </form>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>
              <ShieldCheck size={17} /> Approval
            </h3>
            {canReview ? <span className="tag warning">waiting</span> : <span className="small muted">History below</span>}
          </div>
          <div className="panel-body">
            {canReview ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <form action={adminReviewAdvertisingCampaign} style={{ display: 'grid', gap: 10 }}>
                  <input type="hidden" name="campaign_id" value={campaign.id} />
                  <input type="hidden" name="decision" value="approve" />
                  <div className="field">
                    <label htmlFor="approve_note">Approval note (optional)</label>
                    <input id="approve_note" name="note" placeholder="Creative and destination checked." />
                  </div>
                  <button className="btn primary" type="submit">
                    <ShieldCheck size={15} /> Approve campaign
                  </button>
                </form>
                <form action={adminReviewAdvertisingCampaign} style={{ display: 'grid', gap: 10 }}>
                  <input type="hidden" name="campaign_id" value={campaign.id} />
                  <input type="hidden" name="decision" value="reject" />
                  <div className="field">
                    <label htmlFor="reject_note">Rejection reason</label>
                    <input id="reject_note" name="note" required placeholder="Explain what must change." />
                  </div>
                  <button className="btn coral" type="submit">
                    <Ban size={15} /> Reject campaign
                  </button>
                </form>
              </div>
            ) : (
              <div className="timeline">
                {approvals.length === 0 ? (
                  <p className="muted small">No review has been recorded yet.</p>
                ) : (
                  approvals.map((approval: any) => (
                    <div className="timeline-item" key={approval.id}>
                      <span className="timeline-dot" />
                      <div>
                        <strong>{approval.status}</strong>
                        <div className="small muted">{formatDateTime(approval.reviewed_at ?? approval.created_at)}</div>
                        {approval.note ? <p className="small">{approval.note}</p> : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>Manual overrides</h3>
          <span className="small muted">Every override is written to the advertising audit log.</span>
        </div>
        <div className="panel-body">
          <div className="form-grid">
            <form action={adminOverrideAdvertisingCampaign} className="card flat" style={{ display: 'grid', gap: 10 }}>
              <input type="hidden" name="campaign_id" value={campaign.id} />
              <input type="hidden" name="override_action" value="extend" />
              <strong>
                <CalendarPlus size={16} /> Extend end date
              </strong>
              <div className="field">
                <label htmlFor="ends_at">New end</label>
                <input id="ends_at" name="ends_at" type="datetime-local" defaultValue={toLocalInput(campaign.ends_at)} required />
              </div>
              <button className="btn sm" type="submit">Extend</button>
            </form>

            <form action={adminOverrideAdvertisingCampaign} className="card flat" style={{ display: 'grid', gap: 10 }}>
              <input type="hidden" name="campaign_id" value={campaign.id} />
              <input type="hidden" name="override_action" value="refund" />
              <strong>
                <BadgeDollarSign size={16} /> Record refund
              </strong>
              <div className="field">
                <label htmlFor="refund_amount">Amount (QAR)</label>
                <input id="refund_amount" name="amount" inputMode="decimal" defaultValue={minorToInput(campaign.quote_amount_minor)} required />
              </div>
              <div className="field">
                <label htmlFor="refund_note">Note</label>
                <input id="refund_note" name="note" placeholder="Reason for refund" />
              </div>
              <button className="btn sm coral" type="submit">Refund</button>
            </form>

            <form action={adminOverrideAdvertisingCampaign} className="card flat" style={{ display: 'grid', gap: 10 }}>
              <input type="hidden" name="campaign_id" value={campaign.id} />
              <input type="hidden" name="override_action" value="credit" />
              <strong>
                <Wallet size={16} /> Grant ad credit
              </strong>
              <div className="field">
                <label htmlFor="credit_amount">Amount (QAR)</label>
                <input id="credit_amount" name="amount" inputMode="decimal" required />
              </div>
              <div className="field">
                <label htmlFor="credit_note">Note</label>
                <input id="credit_note" name="note" placeholder="Goodwill credit" />
              </div>
              <button className="btn sm" type="submit">Grant credit</button>
            </form>

            <form action={adminOverrideAdvertisingCampaign} className="card flat" style={{ display: 'grid', gap: 10 }}>
              <input type="hidden" name="campaign_id" value={campaign.id} />
              <input type="hidden" name="override_action" value="capacity_override" />
              <strong>
                <Megaphone size={16} /> Capacity override
              </strong>
              <label className="checkbox-row">
                <input type="checkbox" name="enabled" defaultChecked={campaign.capacity_override} />
                Ignore placement capacity for this campaign
              </label>
              <button className="btn sm" type="submit">Apply</button>
            </form>

            <form action={adminOverrideAdvertisingCampaign} className="card flat" style={{ display: 'grid', gap: 10 }}>
              <input type="hidden" name="campaign_id" value={campaign.id} />
              <input type="hidden" name="override_action" value="feature_business" />
              <strong>
                <Star size={16} /> Feature business
              </strong>
              <label className="checkbox-row">
                <input type="checkbox" name="enabled" defaultChecked={Boolean((campaign.vendors as any)?.is_featured)} />
                Show this advertiser as featured
              </label>
              <button className="btn sm" type="submit">Apply</button>
            </form>

            <form action={adminOverrideAdvertisingCampaign} className="card flat" style={{ display: 'grid', gap: 10 }}>
              <input type="hidden" name="campaign_id" value={campaign.id} />
              <input type="hidden" name="override_action" value="remove" />
              <strong>
                <Ban size={16} /> Remove campaign
              </strong>
              <p className="small muted">Cancels delivery, releases inventory and notifies the advertiser.</p>
              <button className="btn sm coral" type="submit">Remove</button>
            </form>
          </div>
        </div>
      </section>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Transactions</h3>
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
                    <th>Provider / reference</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="muted small">No transactions yet.</td>
                    </tr>
                  ) : (
                    transactions.map((transaction: any) => (
                      <tr key={transaction.id}>
                        <td><span className="tag neutral">{transaction.kind.replace(/_/g, ' ')}</span></td>
                        <td><StatusTag status={transaction.status} /></td>
                        <td className="num">{formatMoney(transaction.amount_minor)}</td>
                        <td className="small">
                          {transaction.provider ?? '—'}
                          <div className="sub mono">{transaction.provider_reference ?? ''}</div>
                        </td>
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
            <h3>Ledger</h3>
            <span className="small muted">Separate from gift-card finance</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Entry</th>
                    <th>Direction</th>
                    <th className="num">Amount</th>
                    <th className="num">Balance after</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="muted small">No ledger entries yet.</td>
                    </tr>
                  ) : (
                    ledger.map((entry: any) => (
                      <tr key={entry.id}>
                        <td>
                          <span className="small">{entry.entry_type.replace(/_/g, ' ')}</span>
                          <div className="sub mono">{entry.entry_key}</div>
                        </td>
                        <td><span className={`tag ${entry.direction === 'credit' ? 'success' : 'neutral'}`}>{entry.direction}</span></td>
                        <td className="num">{formatMoney(entry.amount_minor)}</td>
                        <td className="num">{formatMoney(entry.balance_after_minor)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>Audit trail</h3>
          <span className="small muted">{audit.length} events</span>
        </div>
        <div className="panel-body flush">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Details</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {audit.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted small">No audit events yet.</td>
                  </tr>
                ) : (
                  audit.map((entry: any) => (
                    <tr key={entry.id}>
                      <td><span className="strong">{entry.action.replace(/_/g, ' ')}</span></td>
                      <td className="small">{entry.actor_role ?? 'system'}</td>
                      <td className="small mono" style={{ maxWidth: 420, overflowWrap: 'anywhere' }}>
                        {JSON.stringify(entry.details ?? {})}
                      </td>
                      <td className="small muted">{formatDateTime(entry.created_at)}</td>
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

      {campaign.vendor_id ? (
        <section className="panel">
          <div className="panel-head">
            <h3>Grant advertiser credit</h3>
            <span className="small muted">Credit is spent before any manual payment.</span>
          </div>
          <div className="panel-body">
            <form action={adminGrantAdvertisingCredit} className="inline-form">
              <input type="hidden" name="vendor_id" value={campaign.vendor_id} />
              <input name="amount" placeholder="Amount (QAR)" inputMode="decimal" required />
              <input name="expires_at" type="date" aria-label="Expiry date" />
              <input name="note" placeholder="Note" />
              <button className="btn sm" type="submit">
                <RefreshCw size={15} /> Grant credit
              </button>
            </form>
          </div>
        </section>
      ) : null}
    </div>
  );
}
