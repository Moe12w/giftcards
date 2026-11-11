import Link from 'next/link';
import { Download, FileBarChart, ScanLine, Wallet } from 'lucide-react';
import { requireEnterprise } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { Kpi, PageHead, StatusTag } from '@/components/ui';

const RANGES = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
];

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
        eyebrow="Reports"
        title="The numbers, ready for finance."
        description="Inventory position, allocations and confirmed redemptions. Export the detail whenever you need it."
        actions={
          <>
            <form className="toolbar" action="/enterprise/reports" method="get" style={{ padding: 6, boxShadow: 'none' }}>
              <select name="range" defaultValue={range} aria-label="Date range">
                {RANGES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <button className="btn sm" type="submit">
                Apply
              </button>
            </form>
            <a className="btn sm primary" href={`/enterprise/reports/export?range=${range}`}>
              <Download size={15} /> Export CSV
            </a>
          </>
        }
      />

      <div className="kpi-grid">
        <Kpi
          label="Allocated in period"
          value={String(allocatedInRange.length)}
          hint={`${formatMoney(items.reduce((sum, item) => sum + Number(item.total_minor ?? 0), 0))} in paid orders`}
          icon={<Wallet size={17} />}
          tone="lavender"
        />
        <Kpi
          label="Confirmed redeemed"
          value={String(redeemedInRange.length)}
          hint={`${formatMoney(redeemedValue)} face value`}
          icon={<ScanLine size={17} />}
          tone="mint"
        />
        <Kpi
          label="Paid order value"
          value={formatMoney(soldValue)}
          hint={`${items.length} order items in period`}
          icon={<FileBarChart size={17} />}
          tone="gold"
        />
        <Kpi
          label="Still available"
          value={String(inventory.filter((item) => item.status === 'available').length)}
          hint="Across all products"
          icon={<Wallet size={17} />}
          tone="coral"
        />
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Inventory by product</h3>
            <span className="small muted">Live position</span>
          </div>
          <div className="panel-body flush">
            {products.length === 0 ? (
              <div className="table-empty">No products yet.</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="num">Available</th>
                      <th className="num">Allocated</th>
                      <th className="num">Redeemed</th>
                      <th className="num">Available value</th>
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
            <h3>Redemptions by month</h3>
          </div>
          <div className="panel-body">
            {redeemedInRange.length === 0 ? (
              <p className="small muted">No confirmed redemptions in this period.</p>
            ) : (
              <div style={{ display: 'grid', gap: 14 }}>
                {[...monthly.entries()].map(([key, value]) => {
                  const label = new Date(`${key}-01T00:00:00`).toLocaleDateString('en-QA', {
                    month: 'short',
                    year: 'numeric',
                  });
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
          <h3>Allocated orders in period</h3>
          <span className="small muted">{items.length} items</span>
        </div>
        <div className="panel-body flush">
          {items.length === 0 ? (
            <div className="table-empty">No paid orders in this period.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Product</th>
                    <th>Recipient</th>
                    <th>Date</th>
                    <th className="num">Value</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.slice(0, 50).map((item) => {
                    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
                    const product = products.find((entry) => entry.id === item.enterprise_product_id);
                    return (
                      <tr key={item.id}>
                        <td className="strong">{order?.order_ref ?? '—'}</td>
                        <td>{product?.name ?? 'Product'}</td>
                        <td>{order?.recipient_name ?? '—'}</td>
                        <td className="small muted">{formatDate(item.created_at)}</td>
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
        <Download size={15} style={{ display: 'inline', verticalAlign: '-2px' }} /> The CSV includes every
        code created in the selected period with its reference, product, masked code, value and status
        dates. Full codes are never exported.{' '}
        <Link href="/enterprise/import" style={{ textDecoration: 'underline' }}>
          Reconcile redemptions
        </Link>
        .
      </div>
    </div>
  );
}
