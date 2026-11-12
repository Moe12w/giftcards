import Link from 'next/link';
import { ArrowRight, Banknote, CalendarRange, ScanLine, ShoppingBag, Ticket, TrendingUp } from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { EmptyState, Kpi, PageHead } from '@/components/ui';
import { fulfilmentLabel } from '@/lib/catalog';
import { fill, pick } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { getLocale } from '@/lib/i18n/server';
import { vendorCopy } from '@/lib/i18n/vendor';

const RANGES = [
  { value: '30', copyKey: 'd30' },
  { value: '90', copyKey: 'd90' },
  { value: '365', copyKey: 'd12m' },
] as const;

function monthKey(value: string): string {
  return value.slice(0, 7);
}

export default async function VendorAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = RANGES.some((item) => item.value === params.range) ? params.range! : '90';
  const days = Number(range);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const ctx = await requireVendor();
  const supabase = ctx.supabase;
  const vendor = ctx.vendor;
  const locale = await getLocale();
  const t = pick(vendorCopy, locale).analytics;
  const c = pick(common, locale);
  const rangeLabel = t.ranges[RANGES.find((item) => item.value === range)?.copyKey ?? 'd90'];

  const [itemsResult, vouchersResult, redemptionsResult] = await Promise.all([
    supabase
      .from('order_items')
      .select('id, total_minor, commission_minor, vendor_share_minor, created_at, products(title, fulfilment_type), orders(order_ref, status, created_at)')
      .eq('vendor_id', vendor.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase
      .from('vouchers')
      .select('id, status, fulfilment_type, initial_value_minor, remaining_value_minor, created_at')
      .eq('vendor_id', vendor.id)
      .gte('created_at', since)
      .limit(1000),
    supabase
      .from('redemptions')
      .select('id, kind, amount_minor, sessions, occurred_at')
      .eq('vendor_id', vendor.id)
      .gte('occurred_at', since)
      .limit(1000),
  ]);

  const paidItems = (itemsResult.data ?? []).filter((item) => {
    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
    return order?.status === 'paid';
  });
  const vouchers = vouchersResult.data ?? [];
  const redemptions = redemptionsResult.data ?? [];

  const gross = paidItems.reduce((sum, item) => sum + Number(item.total_minor ?? 0), 0);
  const share = paidItems.reduce((sum, item) => sum + Number(item.vendor_share_minor ?? 0), 0);
  const commission = paidItems.reduce((sum, item) => sum + Number(item.commission_minor ?? 0), 0);
  const orderRefs = new Set(
    paidItems.map((item) => {
      const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
      return order?.order_ref;
    }),
  );

  const redeemedValue = redemptions.reduce(
    (sum, redemption) => sum + Number(redemption.amount_minor ?? 0),
    0,
  );
  const sessionCount = redemptions.reduce((sum, redemption) => sum + Number(redemption.sessions ?? 0), 0);

  const byProduct = new Map<string, { gross: number; units: number; type: string }>();
  for (const item of paidItems) {
    const product = Array.isArray(item.products) ? item.products[0] : item.products;
    const name = product?.title ?? t.gift;
    const current = byProduct.get(name) ?? {
      gross: 0,
      units: 0,
      type: product?.fulfilment_type ?? 'monetary',
    };
    current.gross += Number(item.total_minor ?? 0);
    current.units += 1;
    byProduct.set(name, current);
  }
  const topProducts = [...byProduct.entries()].sort((a, b) => b[1].gross - a[1].gross).slice(0, 8);
  const topMax = topProducts[0]?.[1].gross ?? 1;

  const monthly = new Map<string, number>();
  for (let index = 5; index >= 0; index -= 1) {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - index);
    monthly.set(monthKey(date.toISOString()), 0);
  }
  for (const item of paidItems) {
    const key = monthKey(item.created_at);
    if (monthly.has(key)) monthly.set(key, (monthly.get(key) ?? 0) + Number(item.total_minor ?? 0));
  }
  const monthMax = Math.max(...monthly.values(), 1);

  const activeVouchers = vouchers.filter((voucher) =>
    ['issued', 'claimed', 'active', 'partially_redeemed'].includes(voucher.status),
  ).length;
  const redeemedVouchers = vouchers.filter((voucher) => voucher.status === 'redeemed').length;

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.eyebrow}
        title={t.title}
        description={fill(t.description, { range: rangeLabel.toLowerCase() })}
        actions={
          <form className="toolbar" action="/vendor/analytics" method="get" style={{ padding: 6, boxShadow: 'none' }}>
            <select name="range" defaultValue={range} aria-label={t.dateRangeLabel}>
              {RANGES.map((item) => (
                <option key={item.value} value={item.value}>
                  {t.ranges[item.copyKey]}
                </option>
              ))}
            </select>
            <button className="btn sm" type="submit">
              {c.actions.apply}
            </button>
          </form>
        }
      />

      <div className="kpi-grid">
        <Kpi
          label={t.grossSales}
          value={formatMoney(gross)}
          hint={`${orderRefs.size} ${orderRefs.size === 1 ? t.paidOrder : t.paidOrders}`}
          icon={<Banknote size={17} />}
          tone="mint"
        />
        <Kpi
          label={t.yourShare}
          value={formatMoney(share)}
          hint={fill(t.commission, { amount: formatMoney(commission) })}
          icon={<TrendingUp size={17} />}
          tone="lavender"
        />
        <Kpi
          label={t.vouchersIssued}
          value={String(vouchers.length)}
          hint={fill(t.stillActive, { count: activeVouchers })}
          icon={<Ticket size={17} />}
          tone="gold"
        />
        <Kpi
          label={t.redeemedInPeriod}
          value={formatMoney(redeemedValue)}
          hint={fill(t.sessionsUsed, { count: sessionCount })}
          icon={<ScanLine size={17} />}
          tone="coral"
        />
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>{t.salesByMonth}</h3>
            <span className="tag neutral">
              <CalendarRange size={12} /> {t.lastSixMonths}
            </span>
          </div>
          <div className="panel-body">
            {gross === 0 ? (
              <p className="small muted">{t.noPaidSales}</p>
            ) : (
              <div style={{ display: 'grid', gap: 14 }}>
                {[...monthly.entries()].map(([key, value]) => {
                  const label = new Date(`${key}-01T00:00:00`).toLocaleDateString(
                    locale === 'ar' ? 'ar-QA' : 'en-QA',
                    {
                      month: 'short',
                      year: 'numeric',
                    },
                  );
                  return (
                    <div key={key} style={{ display: 'grid', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <span className="strong">{label}</span>
                        <span>{formatMoney(value)}</span>
                      </div>
                      <div className="progress">
                        <span style={{ width: `${Math.max(value > 0 ? 4 : 0, (value / monthMax) * 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>{t.redemptionMix}</h3>
          </div>
          <div className="panel-body">
            <div className="split-list">
              <div>
                <span className="k">{t.monetaryRedeemed}</span>
                <span className="v">{formatMoney(redeemedValue)}</span>
              </div>
              <div>
                <span className="k">{t.experienceSessions}</span>
                <span className="v">{sessionCount}</span>
              </div>
              <div>
                <span className="k">{t.redemptionRecords}</span>
                <span className="v">{redemptions.length}</span>
              </div>
              <div>
                <span className="k">{t.fullyRedeemedVouchers}</span>
                <span className="v">{redeemedVouchers}</span>
              </div>
            </div>
            <div className="callout info" style={{ marginTop: 14 }}>
              {t.mixNote}
            </div>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>{t.topGifts}</h3>
          <span className="small muted">{fill(t.paidItemsInPeriod, { count: paidItems.length })}</span>
        </div>
        <div className="panel-body flush">
          {topProducts.length === 0 ? (
            <div className="table-empty">{t.noSalesToRank}</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.gift}</th>
                    <th>{c.labels.type}</th>
                    <th className="num">{t.items}</th>
                    <th className="num">{t.grossSales}</th>
                    <th style={{ width: '32%' }}>{t.shareOfSales}</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map(([name, value]) => (
                    <tr key={name}>
                      <td className="strong">{name}</td>
                      <td>
                        <span className="tag">{fulfilmentLabel(value.type, locale)}</span>
                      </td>
                      <td className="num">{value.units}</td>
                      <td className="num strong">{formatMoney(value.gross)}</td>
                      <td>
                        <div className="progress">
                          <span style={{ width: `${Math.max(4, (value.gross / topMax) * 100)}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>{t.recentPaidOrders}</h3>
          <Link className="small" href="/vendor/orders" style={{ fontWeight: 800 }}>
            {t.allOrders} <ArrowRight size={13} style={{ display: 'inline', verticalAlign: '-2px' }} />
          </Link>
        </div>
        <div className="panel-body flush">
          {paidItems.length === 0 ? (
            <div className="table-empty">{t.noPaidOrders}</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.order}</th>
                    <th>{t.gift}</th>
                    <th>{c.labels.date}</th>
                    <th className="num">{c.labels.total}</th>
                    <th className="num">{t.yourShare}</th>
                  </tr>
                </thead>
                <tbody>
                  {paidItems.slice(0, 10).map((item) => {
                    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
                    const product = Array.isArray(item.products) ? item.products[0] : item.products;
                    return (
                      <tr key={item.id}>
                        <td className="strong">{order?.order_ref ?? '—'}</td>
                        <td>{product?.title ?? t.gift}</td>
                        <td className="small muted">{formatDate(item.created_at, locale)}</td>
                        <td className="num">{formatMoney(Number(item.total_minor ?? 0))}</td>
                        <td className="num strong">{formatMoney(Number(item.vendor_share_minor ?? 0))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {gross === 0 && vouchers.length === 0 ? (
        <EmptyState
          title={t.emptyTitle}
          body={t.emptyBody}
          action={
            <Link className="btn primary sm" href="/vendor/products/new">
              <ShoppingBag size={14} /> {t.createGift}
            </Link>
          }
        />
      ) : null}
    </div>
  );
}
