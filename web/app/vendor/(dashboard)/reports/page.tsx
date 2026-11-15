import Link from 'next/link';
import { ArrowRight, Banknote, Download, FileBarChart, TrendingUp, Wallet } from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { Kpi, PageHead } from '@/components/ui';
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

export default async function VendorReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = RANGES.some((item) => item.value === params.range) ? params.range! : '90';
  const days = Number(range);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const ctx = await requireVendor();
  const locale = await getLocale();
  const t = pick(vendorCopy, locale).reports;
  const c = pick(common, locale);
  const rangeLabel = t.ranges[RANGES.find((item) => item.value === range)?.copyKey ?? 'd90'];

  const { data: orderItems } = await ctx.supabase
    .from('order_items')
    .select('id, total_minor, commission_minor, vendor_share_minor, created_at, products(title), orders(order_ref, status, created_at)')
    .eq('vendor_id', ctx.vendor.id)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1000);

  const paidItems = (orderItems ?? []).filter((item) => {
    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
    return order?.status === 'paid';
  });

  // The customer pays the gross, Giftly keeps the commission, the rest is the vendor's.
  const gross = paidItems.reduce((sum, item) => sum + Number(item.total_minor ?? 0), 0);
  const commission = paidItems.reduce((sum, item) => sum + Number(item.commission_minor ?? 0), 0);
  const share = paidItems.reduce((sum, item) => sum + Number(item.vendor_share_minor ?? 0), 0);
  const orderRefs = new Set(
    paidItems.map((item) => {
      const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
      return order?.order_ref;
    }),
  );
  const effectiveBps = gross > 0 ? Math.round((commission / gross) * 10000) : 0;

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

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.eyebrow}
        title={t.title}
        description={fill(t.description, { range: rangeLabel.toLowerCase() })}
        actions={
          <>
            <form className="toolbar" action="/vendor/reports" method="get" style={{ padding: 6, boxShadow: 'none' }}>
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
            <a className="btn sm primary" href={`/vendor/reports/export?range=${range}`}>
              <Download size={15} /> {t.exportCsv}
            </a>
          </>
        }
      />

      <div className="kpi-grid">
        <Kpi
          label={t.grossSales}
          value={formatMoney(gross)}
          hint={fill(t.paidItemsInPeriod, { count: paidItems.length })}
          icon={<Banknote size={17} />}
          tone="mint"
        />
        <Kpi
          label={t.commission}
          value={formatMoney(commission)}
          hint={fill(t.percentOfEveryCode, { percent: (effectiveBps / 100).toFixed(2) })}
          icon={<TrendingUp size={17} />}
          tone="gold"
        />
        <Kpi
          label={t.yourShare}
          value={formatMoney(share)}
          hint={t.afterOurCut}
          icon={<Wallet size={17} />}
          tone="lavender"
        />
        <Kpi
          label={t.paidOrders}
          value={String(orderRefs.size)}
          icon={<FileBarChart size={17} />}
          tone="coral"
        />
      </div>

      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h3>{t.money}</h3>
          <span className="small muted">{t.priceAndCut}</span>
        </div>
        <div className="panel-body">
          <div className="grid-3">
            <div className="card mint">
              <span className="small muted">{t.soldValue}</span>
              <div className="strong" style={{ fontSize: '1.6rem', marginTop: 6 }}>
                {formatMoney(gross)}
              </div>
              <span className="small muted">{fill(t.priceTimesSold, { count: paidItems.length })}</span>
            </div>
            <div className="card gold">
              <span className="small muted">{t.giftlyCut}</span>
              <div className="strong" style={{ fontSize: '1.6rem', marginTop: 6 }}>
                {formatMoney(commission)}
              </div>
              <span className="small muted">
                {fill(t.percentOfEveryCode, { percent: (effectiveBps / 100).toFixed(2) })}
              </span>
            </div>
            <div className="card lavender">
              <span className="small muted">{t.yourShare}</span>
              <div className="strong" style={{ fontSize: '1.6rem', marginTop: 6 }}>
                {formatMoney(share)}
              </div>
              <span className="small muted">{t.afterOurCut}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>{t.salesByMonth}</h3>
            <span className="tag neutral">{t.lastSixMonths}</span>
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
                      numberingSystem: 'latn',
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
            <h3>{t.ordersTable}</h3>
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
                          <td>{product?.title ?? '—'}</td>
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
      </div>

      <div className="callout info">
        <Download size={15} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t.csvNote}{' '}
        <Link href="/vendor/analytics" style={{ textDecoration: 'underline' }}>
          {t.seeAnalytics}
        </Link>
        .
      </div>
    </div>
  );
}
