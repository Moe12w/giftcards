import Link from 'next/link';
import {
  BadgeDollarSign,
  Bell,
  Eye,
  Megaphone,
  MousePointerClick,
  Pause,
  Play,
  Plus,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { requireAdvertiser } from '@/lib/auth';
import { formatDate, formatDateTime } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { EmptyState, Kpi, Notice, PageHead, StatusTag } from '@/components/ui';
import { pauseAdvertisingCampaign, resumeAdvertisingCampaign } from '@/lib/actions/advertising';

export default async function VendorAdvertisingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; paused?: string; resumed?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdvertiser({ prefer: 'enterprise' });
  const vendor = ctx.vendor;

  const [campaignsResult, statsResult, notificationsResult, creditsResult] = await Promise.all([
    ctx.supabase
      .from('advertising_campaigns')
      .select('*, advertising_placements(name,key), advertising_creatives(headline, image_url)')
      .eq('vendor_id', vendor.id)
      .order('created_at', { ascending: false })
      .limit(200),
    ctx.supabase
      .from('advertising_daily_stats')
      .select('campaign_id, impressions, clicks, conversions, spend_minor')
      .eq('vendor_id', vendor.id)
      .limit(5000),
    ctx.supabase
      .from('advertising_notifications')
      .select('*')
      .eq('vendor_id', vendor.id)
      .order('created_at', { ascending: false })
      .limit(8),
    ctx.supabase
      .from('advertising_promotional_credits')
      .select('remaining_minor, status, expires_at')
      .eq('vendor_id', vendor.id)
      .eq('status', 'available'),
  ]);

  const campaigns = campaignsResult.data ?? [];
  const stats = statsResult.data ?? [];
  const notifications = notificationsResult.data ?? [];
  const credits = creditsResult.data ?? [];

  const impressions = stats.reduce((sum: number, row: any) => sum + Number(row.impressions ?? 0), 0);
  const clicks = stats.reduce((sum: number, row: any) => sum + Number(row.clicks ?? 0), 0);
  const conversions = stats.reduce((sum: number, row: any) => sum + Number(row.conversions ?? 0), 0);
  const spend = stats.reduce((sum: number, row: any) => sum + Number(row.spend_minor ?? 0), 0);
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const availableCredit = credits.reduce((sum: number, row: any) => sum + Number(row.remaining_minor ?? 0), 0);

  const count = (status: string) => campaigns.filter((campaign: any) => campaign.status === status).length;
  const unread = notifications.filter((notification: any) => !notification.read_at).length;
  const advertisingEnabled = (vendor as any).advertising_enabled !== false;

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Advertising & promotions"
        title="Advertising"
        description="Promote your business and gift cards across the marketplace. Every campaign is paid, approved and measured separately from your gift-card sales."
        actions={
          <>
            {availableCredit > 0 ? (
              <span className="tag success">
                <Wallet size={14} /> {formatMoney(availableCredit)} credit
              </span>
            ) : null}
            <Link className="btn sm primary" href={`${ctx.home}/new`}>
              <Plus size={15} /> New campaign
            </Link>
          </>
        }
      />
      <Notice
        error={params.error ?? campaignsResult.error?.message}
        success={
          params.saved === '1'
            ? 'Saved.'
            : params.paused === '1'
              ? 'Campaign paused.'
              : params.resumed === '1'
                ? 'Campaign resumed.'
                : null
        }
      />

      {!advertisingEnabled ? (
        <div className="callout error">
          Advertising access is suspended for this business. Your vendor account is still active. Contact the platform
          team if you believe this is a mistake.
        </div>
      ) : null}

      <div className="kpi-grid">
        <Kpi
          label="Active campaigns"
          value={String(count('active'))}
          hint={`${count('scheduled')} scheduled · ${count('pending_approval') + count('pending_payment')} pending`}
          tone="mint"
          icon={<Megaphone size={17} />}
        />
        <Kpi
          label="Impressions"
          value={impressions.toLocaleString('en-QA')}
          hint="Only counted when an ad is displayed"
          tone="lavender"
          icon={<Eye size={17} />}
        />
        <Kpi
          label="Clicks"
          value={clicks.toLocaleString('en-QA')}
          hint={`${ctr.toFixed(2)}% CTR`}
          tone="sky"
          icon={<MousePointerClick size={17} />}
        />
        <Kpi
          label="Conversions"
          value={conversions.toLocaleString('en-QA')}
          hint="Inside the attribution window"
          tone="gold"
          icon={<TrendingUp size={17} />}
        />
        <Kpi
          label="Advertising spend"
          value={formatMoney(spend)}
          hint="Separate from gift-card sales"
          tone="coral"
          icon={<BadgeDollarSign size={17} />}
        />
      </div>

      {notifications.length > 0 ? (
        <section className="panel">
          <div className="panel-head">
            <h3>
              <Bell size={17} /> Recent activity
            </h3>
            <span className="small muted">{unread} unread</span>
          </div>
          <div className="panel-body">
            <div className="timeline">
              {notifications.map((notification: any) => (
                <div className="timeline-item" key={notification.id}>
                  <span className={`timeline-dot${notification.read_at ? '' : ' active'}`} />
                  <div>
                    <strong>{notification.title}</strong>
                    {notification.body ? <p className="small muted">{notification.body}</p> : null}
                    <span className="sub">{formatDateTime(notification.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {campaigns.length === 0 ? (
        <EmptyState
          title="No advertising campaigns yet"
          body="Create your first campaign to appear on the homepage carousel, featured business row or other placements."
          action={
            <Link className="btn primary" href={`${ctx.home}/new`}>
              <Plus size={15} /> Create a campaign
            </Link>
          }
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>Your campaigns</h3>
            <span className="small muted">Pause, resume and open any campaign for full detail.</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Placement</th>
                    <th>Model</th>
                    <th className="num">Budget / quote</th>
                    <th>Status</th>
                    <th>Schedule</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((campaign: any) => {
                    const campaignStats = stats.filter((row: any) => row.campaign_id === campaign.id);
                    const campaignImpressions = campaignStats.reduce(
                      (sum: number, row: any) => sum + Number(row.impressions ?? 0),
                      0,
                    );
                    const campaignClicks = campaignStats.reduce(
                      (sum: number, row: any) => sum + Number(row.clicks ?? 0),
                      0,
                    );
                    return (
                      <tr key={campaign.id}>
                        <td>
                          <span className="strong">{campaign.name}</span>
                          <div className="sub mono">{campaign.campaign_ref}</div>
                          <div className="sub">
                            {campaignImpressions.toLocaleString('en-QA')} views · {campaignClicks.toLocaleString('en-QA')} clicks
                          </div>
                        </td>
                        <td className="small">{campaign.advertising_placements?.name ?? campaign.placement_key}</td>
                        <td>
                          <span className="tag neutral">{campaign.pricing_model.toUpperCase()}</span>
                        </td>
                        <td className="num">
                          {campaign.pricing_model === 'fixed'
                            ? formatMoney(campaign.fixed_price_minor)
                            : formatMoney(campaign.total_budget_minor)}
                        </td>
                        <td>
                          <StatusTag status={campaign.status} />
                          <div className="sub">{campaign.payment_status}</div>
                          {campaign.pause_reason ? (
                            <div className="sub">{campaign.pause_reason.replace(/_/g, ' ')}</div>
                          ) : null}
                        </td>
                        <td className="small muted">
                          {formatDate(campaign.starts_at)} → {formatDate(campaign.ends_at)}
                        </td>
                        <td>
                          <div className="row-actions" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <Link className="btn sm ghost" href={`${ctx.home}/campaigns/${campaign.id}`}>
                              Open
                            </Link>
                            {['active', 'scheduled', 'pending_approval'].includes(campaign.status) ? (
                              <form action={pauseAdvertisingCampaign}>
                                <input type="hidden" name="campaign_id" value={campaign.id} />
                                <button className="btn sm" type="submit">
                                  <Pause size={14} /> Pause
                                </button>
                              </form>
                            ) : null}
                            {campaign.status === 'paused' ? (
                              <form action={resumeAdvertisingCampaign}>
                                <input type="hidden" name="campaign_id" value={campaign.id} />
                                <button className="btn sm primary" type="submit">
                                  <Play size={14} /> Resume
                                </button>
                              </form>
                            ) : null}
                            {['draft', 'pending_payment', 'rejected'].includes(campaign.status) ? (
                              <Link className="btn sm primary" href={`${ctx.home}/checkout/${campaign.id}`}>
                                Checkout
                              </Link>
                            ) : null}
                          </div>
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
