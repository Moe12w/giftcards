import Link from 'next/link';
import { Download, FileBarChart, ScanLine, Wallet } from 'lucide-react';
import { requireEnterprise } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { Kpi, PageHead, StatusTag } from '@/components/ui';
import { fill, pick } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { enterpriseCopy } from '@/lib/i18n/enterprise';
import { getLocale } from '@/lib/i18n/server';

const RANGES = [
  { value: '30', copyKey: 'd30' },
  { value: '90', copyKey: 'd90' },
  { value: '365', copyKey: 'd12m' },
] as const;

function monthKey(value: string): string {
  return value.slice(0, 7);
}

export default async function EnterpriseReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = RANGES.some((item) => item.value === params.range) ? params.range! : '90';
  const days = Number(range);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const ctx = await requireEnterprise();
  const locale = await getLocale();
  const t = pick(enterpriseCopy, locale).reports;
  const c = pick(common, locale);
  const [productsResult, inventoryResult] = await Promise.all([
    ctx.supabase
      .from('enterprise_products')
      .select('id, name, denomination_minor, selling_price_minor, commission_bps')
      .eq('partner_id', ctx.partner.id)
      .order('name'),
    ctx.supabase
      .from('enterprise_inventory_summary')
      .select('*')
      .eq('partner_id', ctx.partner.id)
      .limit(5000),
  ]);

  const products = productsResult.data ?? [];
  const inventory = inventoryResult.data ?? [];

  const productIds = products.map((product) => product.id);
  const { data: orderItems } = productIds.length
    ? await ctx.supabase
        .from('order_items')
        .select('id, total_minor, created_at, enterprise_product_id, orders(order_ref, status, created_at, recipient_name)')
        .in('enterprise_product_id', productIds)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1000)
    : { data: [] };

  const items = (orderItems ?? []).filter((item) => {
    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
    return order?.status === 'paid';
  });

  const redeemedInRange = inventory.filter(
    (item) => item.confirmed_redeemed_at && item.confirmed_redeemed_at >= since,
  );
  const allocatedInRange = inventory.filter(
    (item) => item.allocated_at && item.allocated_at >= since,
  );
  const redeemedValue = redeemedInRange.reduce((sum, item) => sum + Number(item.denomination_minor ?? 0), 0);
  const soldValue = items.reduce((sum, item) => sum + Number(item.total_minor ?? 0), 0);

  // The partner sets the price, Giftly takes its cut, the rest is theirs.
  const commissionBps = products.length
    ? Math.round(
        products.reduce((sum, product) => sum + Number(product.commission_bps ?? 0), 0) /
          products.length,
      )
    : 0;
  const giftlyCut = Math.round((soldValue * commissionBps) / 10000);
  const partnerNet = soldValue - giftlyCut;
  const outstandingValue = inventory
    .filter((item) => item.status === 'available')
    .reduce((sum, item) => sum + Number(item.denomination_minor ?? 0), 0);

  const byProduct = new Map<
    string,
    { name: string; available: number; allocated: number; redeemed: number; availableValue: number }
  >();
  for (const product of products) {
    byProduct.set(product.id, {
      name: product.name,
      available: 0,
      allocated: 0,
      redeemed: 0,
      availableValue: 0,
    });
  }
  for (const item of inventory) {
    const entry = byProduct.get(item.enterprise_product_id);
    if (!entry) continue;
    if (item.status === 'available') {
      entry.available += 1;
      entry.availableValue += Number(item.denomination_minor ?? 0);
    } else if (['reserved', 'sold', 'delivered'].includes(item.status)) {
      entry.allocated += 1;
    } else if (item.status === 'redeemed') {
      entry.redeemed += 1;
    }
  }

  const monthly = new Map<string, number>();
  for (let index = 5; index >= 0; index -= 1) {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - index);
    monthly.set(monthKey(date.toISOString()), 0);
  }
  for (const item of redeemedInRange) {
    const key = monthKey(item.confirmed_redeemed_at!);
    if (monthly.has(key)) monthly.set(key, (monthly.get(key) ?? 0) + Number(item.denomination_minor ?? 0));
  }
  const monthMax = Math.max(...monthly.values(), 1);

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
        actions={
          <>
            <form className="toolbar" action="/enterprise/reports" method="get" style={{ padding: 6, boxShadow: 'none' }}>
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
            <a className="btn sm primary" href={`/enterprise/reports/export?range=${range}`}>
              <Download size={15} /> {t.exportCsv}
            </a>
          </>
        }
      />

      <div className="kpi-grid">
        <Kpi
          label={t.soldToCustomers}
          value={String(allocatedInRange.length)}
          hint={fill(t.inPaidOrders, { amount: formatMoney(soldValue) })}
          icon={<Wallet size={17} />}
          tone="lavender"
        />
        <Kpi
          label={t.usedByCustomers}
          value={String(redeemedInRange.length)}
          hint={fill(t.ofCreditSpent, { amount: formatMoney(redeemedValue) })}
          icon={<ScanLine size={17} />}
          tone="mint"
        />
        <Kpi
          label={t.paidOrderValue}
          value={formatMoney(soldValue)}
          hint={fill(t.orderItemsInPeriod, { count: items.length })}
          icon={<FileBarChart size={17} />}
          tone="gold"
        />
        <Kpi
          label={t.stillAvailable}
          value={String(inventory.filter((item) => item.status === 'available').length)}
          hint={fill(t.leftToSell, { amount: formatMoney(outstandingValue) })}
          icon={<Wallet size={17} />}
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
              <span className="small muted">{t.soldToCustomers}</span>
              <div className="strong" style={{ fontSize: '1.6rem', marginTop: 6 }}>
                {formatMoney(soldValue)}
              </div>
              <span className="small muted">{fill(t.priceTimesSold, { count: items.length })}</span>
            </div>
            <div className="card gold">
              <span className="small muted">{t.giftlyCut}</span>
              <div className="strong" style={{ fontSize: '1.6rem', marginTop: 6 }}>
                {formatMoney(giftlyCut)}
              </div>
              <span className="small muted">
                {fill(t.percentOfEveryCode, { percent: (commissionBps / 100).toFixed(2) })}
              </span>
            </div>
            <div className="card lavender">
              <span className="small muted">{t.yourShare}</span>
              <div className="strong" style={{ fontSize: '1.6rem', marginTop: 6 }}>
                {formatMoney(partnerNet)}
              </div>
              <span className="small muted">{t.afterOurCut}</span>
            </div>
          </div>
          <div className="callout info" style={{ marginTop: 16 }}>
            <Wallet size={15} style={{ display: 'inline', verticalAlign: '-2px' }} /> {fill(t.unsoldNote, {
              amount: formatMoney(outstandingValue),
            })}
          </div>
        </div>
      </section>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>{t.inventoryByProduct}</h3>
            <span className="small muted">{t.livePosition}</span>
          </div>
          <div className="panel-body flush">
            {products.length === 0 ? (
              <div className="table-empty">{t.noProductsYet}</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t.productHeader}</th>
                      <th className="num">{t.available}</th>
                      <th className="num">{t.allocated}</th>
                      <th className="num">{t.redeemed}</th>
                      <th className="num">{t.availableValue}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...byProduct.entries()].map(([id, entry]) => (
                      <tr key={id}>
                        <td className="strong">{entry.name}</td>
                        <td className="num">{entry.available}</td>
                        <td className="num">{entry.allocated}</td>
                        <td className="num">{entry.redeemed}</td>
                        <td className="num">{formatMoney(entry.availableValue)}</td>
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
            <h3>{t.redemptionsByMonth}</h3>
          </div>
          <div className="panel-body">
            {redeemedInRange.length === 0 ? (
              <p className="small muted">{t.noConfirmedRedemptions}</p>
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
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>{t.allocatedOrders}</h3>
          <span className="small muted">{fill(t.items, { count: items.length })}</span>
        </div>
        <div className="panel-body flush">
          {items.length === 0 ? (
            <div className="table-empty">{t.noPaidOrders}</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.order}</th>
                    <th>{t.productHeader}</th>
                    <th>{t.recipient}</th>
                    <th>{c.labels.date}</th>
                    <th className="num">{c.labels.value}</th>
                    <th>{c.labels.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.slice(0, 50).map((item) => {
                    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
                    const product = products.find((entry) => entry.id === item.enterprise_product_id);
                    return (
                      <tr key={item.id}>
                        <td className="strong">{order?.order_ref ?? '—'}</td>
                        <td>{product?.name ?? t.productFallback}</td>
                        <td>{order?.recipient_name ?? '—'}</td>
                        <td className="small muted">{formatDate(item.created_at, locale)}</td>
                        <td className="num">{formatMoney(Number(item.total_minor ?? 0))}</td>
                        <td>
                          <StatusTag status={order?.status ?? 'pending'} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <div className="callout info">
        <Download size={15} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t.csvNote}{' '}
        <Link href="/enterprise/import" style={{ textDecoration: 'underline' }}>
          {t.reconcileRedemptions}
        </Link>
        .
      </div>
    </div>
  );
}
