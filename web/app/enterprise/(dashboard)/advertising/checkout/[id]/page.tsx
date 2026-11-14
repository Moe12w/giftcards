import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BadgeCheck, CreditCard, Receipt, ShieldCheck, Wallet } from 'lucide-react';
import { requireAdvertiser } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { Notice, PageHead, ReadRow, StatusTag } from '@/components/ui';
import { payAdvertisingWithCredit, submitAdvertisingCampaign } from '@/lib/actions/advertising';

export default async function AdvertisingCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string; error?: string }>;
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

  const { data: credits } = await ctx.supabase
    .from('advertising_promotional_credits')
    .select('remaining_minor')
    .eq('vendor_id', ctx.vendor.id)
    .eq('status', 'available')
    .gt('remaining_minor', 0);

  const availableCredit = (credits ?? []).reduce((sum: number, row: any) => sum + Number(row.remaining_minor ?? 0), 0);
  const creative = (campaign.advertising_creatives ?? [])[0];
  const paid = campaign.payment_status === 'paid';
  const canSubmit = ['draft', 'rejected'].includes(campaign.status);
  const canPayWithCredit = !paid && availableCredit >= Number(campaign.quote_amount_minor ?? 0);

  return (
    <div className="dash-content">
      <Link className="back-link" href={ctx.home}>
        <ArrowLeft size={15} /> Advertising
      </Link>
      <PageHead
        eyebrow="Checkout"
        title={campaign.name}
        description="Payment is verified on the server. A browser success flag can never activate a campaign."
        actions={
          paid ? (
            <Link className="btn sm primary" href={`${ctx.home}/campaigns/${campaign.id}`}>
              Open campaign
            </Link>
          ) : null
        }
      />
      <Notice
        error={query.error}
        success={
          query.submitted === '1'
            ? 'Campaign submitted. The platform team will verify the payment reference.'
            : null
        }
      />

      <div className="pill-row">
        <StatusTag status={campaign.status} />
        <StatusTag status={campaign.payment_status} />
        <span className="tag neutral">{campaign.advertising_placements?.name ?? campaign.placement_key}</span>
        <span className="tag lavender">{campaign.pricing_model.toUpperCase()}</span>
      </div>

      {paid ? (
        <div className="callout info">
          <BadgeCheck size={16} /> Payment is verified for reference{' '}
          <span className="mono">{campaign.payment_reference ?? '—'}</span>. The campaign is now following the
          approval, eligibility and capacity rules.
        </div>
      ) : null}

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>
              <Receipt size={17} /> Order summary
            </h3>
            <span className="small muted">{campaign.campaign_ref}</span>
          </div>
          <div className="panel-body">
            <div className="split-list">
              <ReadRow label="Placement" value={campaign.advertising_placements?.name ?? campaign.placement_key} />
              <ReadRow label="Pricing model" value={campaign.pricing_model.toUpperCase()} />
              <ReadRow
                label="Rate"
                value={
                  campaign.pricing_model === 'fixed'
                    ? formatMoney(campaign.quote_amount_minor)
                    : campaign.pricing_model === 'cpc'
                      ? `${formatMoney(campaign.cpc_rate_minor)} / click`
                      : `${formatMoney(campaign.cpm_rate_minor)} / 1,000 impressions`
                }
              />
              <ReadRow label="Starts" value={formatDateTime(campaign.starts_at)} />
              <ReadRow label="Ends" value={formatDateTime(campaign.ends_at)} />
              <ReadRow label="Slot" value={campaign.slot_number ? `Slot ${campaign.slot_number}` : 'Shared placement'} />
              <ReadRow
                label="Total budget"
                value={formatMoney(campaign.pricing_model === 'fixed' ? campaign.quote_amount_minor : campaign.total_budget_minor)}
              />
              <ReadRow
                label="Daily budget"
                value={campaign.daily_budget_minor > 0 ? formatMoney(campaign.daily_budget_minor) : 'No daily cap'}
              />
              <ReadRow label="Auto-renew" value="None — book again when the window ends" />
              <ReadRow label="Payment reference" value={<span className="mono">{campaign.payment_reference ?? 'Generated on submit'}</span>} />
            </div>
            <div className="divider" />
            <div className="mini-row">
              <span className="strong" style={{ fontSize: 18 }}>Amount due</span>
              <span className="strong" style={{ fontSize: 24 }}>{formatMoney(campaign.quote_amount_minor)}</span>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>
              <CreditCard size={17} /> Payment
            </h3>
            {paid ? <span className="tag success">paid</span> : <span className="tag warning">unpaid</span>}
          </div>
          <div className="panel-body">
            {paid ? (
              <p className="small muted">
                This campaign is fully paid. No further payment is required unless you extend or renew it.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: 14 }}>
                <div className="card flat">
                  <div className="mini-row">
                    <span className="small muted">Advertising credit available</span>
                    <span className="strong">{formatMoney(availableCredit)}</span>
                  </div>
                  <p className="small muted" style={{ marginTop: 6 }}>
                    Credit is applied before any manual payment and activates the campaign immediately once the
                    server verifies the balance.
                  </p>
                  <form action={payAdvertisingWithCredit} style={{ marginTop: 10 }}>
                    <input type="hidden" name="campaign_id" value={campaign.id} />
                    <button className="btn primary" type="submit" disabled={!canPayWithCredit}>
                      <Wallet size={15} /> Pay {formatMoney(campaign.quote_amount_minor)} with credit
                    </button>
                  </form>
                  {!canPayWithCredit ? (
                    <p className="small muted" style={{ marginTop: 6 }}>
                      You need at least {formatMoney(campaign.quote_amount_minor)} of advertising credit.
                    </p>
                  ) : null}
                </div>

                <div className="card flat">
                  <strong>Bank transfer / manual verification</strong>
                  <p className="small muted">
                    Submit the campaign to generate a payment reference. The platform team verifies the transfer and
                    confirms the payment on the server. The campaign cannot activate before that confirmation.
                  </p>
                  {canSubmit ? (
                    <form action={submitAdvertisingCampaign} style={{ marginTop: 10 }}>
                      <input type="hidden" name="campaign_id" value={campaign.id} />
                      <button className="btn" type="submit">
                        <ShieldCheck size={15} /> Submit for payment verification
                      </button>
                    </form>
                  ) : (
                    <div className="callout info" style={{ marginTop: 10 }}>
                      Reference <span className="mono">{campaign.payment_reference ?? '—'}</span> is waiting for
                      verification. You will be notified as soon as it is confirmed.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {creative ? (
        <section className="panel">
          <div className="panel-head">
            <h3>Creative preview</h3>
            <StatusTag status={creative.status} />
          </div>
          <div className="panel-body">
            <div className="card flat" style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
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
              <span className="btn sm primary" style={{ width: 'fit-content' }}>
                {creative.cta_label ?? 'Learn more'}
              </span>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
