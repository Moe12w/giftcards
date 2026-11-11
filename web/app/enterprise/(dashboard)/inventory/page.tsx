import Link from 'next/link';
import { Boxes, Search } from 'lucide-react';
import { requireEnterprise } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';
import type { InventoryStatus } from '@/lib/types';

const STATUSES: InventoryStatus[] = [
  'available',
  'reserved',
  'sold',
  'delivered',
  'redeemed',
  'expired',
  'invalid',
  'cancelled',
  'quarantined',
];

export default async function EnterpriseInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; product?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireEnterprise();
  const q = (params.q ?? '').trim().toLowerCase();
  const status = params.status ?? '';
  const productFilter = params.product ?? '';

  const [productsResult, inventoryResult] = await Promise.all([
    ctx.supabase
      .from('enterprise_products')
      .select('id, name, denomination_minor')
      .eq('partner_id', ctx.partner.id)
      .order('name'),
    ctx.supabase
      .from('enterprise_inventory_summary')
      .select('*')
      .eq('partner_id', ctx.partner.id)
      .order('created_at', { ascending: false })
      .limit(2000),
  ]);

  const products = productsResult.data ?? [];
  const productNames = new Map(products.map((product) => [product.id, product.name]));
  const all = inventoryResult.data ?? [];

  const inventory = all.filter((item) => {
    if (status && item.status !== status) return false;
    if (productFilter && item.enterprise_product_id !== productFilter) return false;
    if (!q) return true;
    return [item.inventory_ref, item.code_masked].filter(Boolean).join(' ').toLowerCase().includes(q);
  });

  const available = all.filter((item) => item.status === 'available');
  const availableValue = available.reduce((sum, item) => sum + Number(item.denomination_minor ?? 0), 0);
  const allocated = all.filter((item) => ['reserved', 'sold', 'delivered'].includes(item.status));
  const redeemed = all.filter((item) => item.status === 'redeemed');

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Inventory"
        title="Every code, accounted for."
        description="Codes are stored encrypted. Only the last four digits are shown here; the full code is revealed to the recipient when allocated."
        actions={
          <Link className="btn sm primary" href="/enterprise/import">
            <Boxes size={15} /> Import codes
          </Link>
        }
      />

      <Notice error={params.error} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
            <Boxes size={17} />
          </span>
          <strong>{available.length}</strong>
          <span>Available</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--lavender-soft)' }}>
            <Boxes size={17} />
          </span>
          <strong>{allocated.length}</strong>
          <span>Allocated or delivered</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <Boxes size={17} />
          </span>
          <strong>{redeemed.length}</strong>
          <span>Confirmed redeemed</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--coral-soft)' }}>
            <Boxes size={17} />
          </span>
          <strong>{formatMoney(availableValue)}</strong>
          <span>Available face value</span>
        </div>
      </div>

      <form className="toolbar" action="/enterprise/inventory" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input name="q" defaultValue={params.q ?? ''} placeholder="Reference or last four digits…" aria-label="Search inventory" />
        </div>
        <select name="product" defaultValue={productFilter} aria-label="Product">
          <option value="">All products</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <button className="btn sm" type="submit">
          Filter
        </button>
        {q || status || productFilter ? (
          <Link className="btn sm ghost" href="/enterprise/inventory">
            Clear
          </Link>
        ) : null}
      </form>

      {inventory.length === 0 ? (
        <EmptyState
          title={all.length === 0 ? 'No codes imported yet' : 'No codes match'}
          body={
            all.length === 0
              ? 'Choose a product and paste your codes. We encrypt each one and check for duplicates before storing it.'
              : 'Try a different reference, product or status.'
          }
          action={
            all.length === 0 ? (
              <Link className="btn primary sm" href="/enterprise/import">
                Import codes
              </Link>
            ) : undefined
          }
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>
              {inventory.length} {inventory.length === 1 ? 'code' : 'codes'}
            </h3>
            <span className="small muted">Showing up to 2,000</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Product</th>
                    <th>Code</th>
                    <th className="num">Value</th>
                    <th>Status</th>
                    <th>Allocated</th>
                    <th>Delivered</th>
                    <th>Redeemed</th>
                    <th>Expires</th>
                    <th>Imported</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((item) => (
                    <tr key={item.inventory_id}>
                      <td className="strong mono small">{item.inventory_ref}</td>
                      <td>{productNames.get(item.enterprise_product_id) ?? 'Product'}</td>
                      <td className="mono masked">{item.code_masked}</td>
                      <td className="num">{formatMoney(Number(item.denomination_minor))}</td>
                      <td>
                        <StatusTag status={item.status} />
                      </td>
                      <td className="small muted">{item.allocated_at ? formatDate(item.allocated_at) : '—'}</td>
                      <td className="small muted">{item.delivered_at ? formatDate(item.delivered_at) : '—'}</td>
                      <td className="small muted">
                        {item.confirmed_redeemed_at ? formatDate(item.confirmed_redeemed_at) : '—'}
                      </td>
                      <td className="small muted">{item.expires_at ? formatDate(item.expires_at) : 'No expiry'}</td>
                      <td className="small muted">{formatDate(item.created_at)}</td>
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
