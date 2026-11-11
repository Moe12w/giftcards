import Link from 'next/link';
import { Pencil, Plus, Power, Search } from 'lucide-react';
import { requireEnterprise } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { toggleEnterpriseProduct } from '@/lib/actions/enterprise';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';

export default async function EnterpriseProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireEnterprise();
  const q = (params.q ?? '').trim().toLowerCase();
  const status = params.status ?? '';

  const [productsResult, inventoryResult] = await Promise.all([
    ctx.supabase
      .from('enterprise_products')
      .select('*')
      .eq('partner_id', ctx.partner.id)
      .order('created_at', { ascending: false }),
    ctx.supabase
      .from('enterprise_inventory_summary')
      .select('enterprise_product_id, status')
      .eq('partner_id', ctx.partner.id)
      .limit(5000),
  ]);

  const inventory = inventoryResult.data ?? [];
  const counts = new Map<string, { available: number; allocated: number; redeemed: number }>();
  for (const item of inventory) {
    const current = counts.get(item.enterprise_product_id) ?? { available: 0, allocated: 0, redeemed: 0 };
    if (item.status === 'available') current.available += 1;
    else if (['reserved', 'sold', 'delivered'].includes(item.status)) current.allocated += 1;
    else if (item.status === 'redeemed') current.redeemed += 1;
    counts.set(item.enterprise_product_id, current);
  }

  const products = (productsResult.data ?? []).filter((product) => {
    if (status === 'active' && !product.is_active) return false;
    if (status === 'paused' && product.is_active) return false;
    if (!q) return true;
    return [product.name, product.external_ref].filter(Boolean).join(' ').toLowerCase().includes(q);
  });

  const canManage = ctx.role !== 'analyst';

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Catalogue"
        title="Reward products"
        description="Each product defines a denomination, price and validity. Import codes against a product to build inventory."
        actions={
          canManage ? (
            <Link className="btn sm primary" href="/enterprise/products/new">
              <Plus size={15} /> New product
            </Link>
          ) : undefined
        }
      />

      <Notice
        error={params.error}
        success={params.saved === '1' ? 'Product saved.' : null}
      />

      <form className="toolbar" action="/enterprise/products" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input name="q" defaultValue={params.q ?? ''} placeholder="Search products…" aria-label="Search products" />
        </div>
        <select name="status" defaultValue={status} aria-label="Product status">
          <option value="">All products</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
        </select>
        <button className="btn sm" type="submit">
          Filter
        </button>
        {q || status ? (
          <Link className="btn sm ghost" href="/enterprise/products">
            Clear
          </Link>
        ) : null}
      </form>

      {products.length === 0 ? (
        <EmptyState
          title={q || status ? 'No products match' : 'No reward products yet'}
          body={
            q || status
              ? 'Try a different search or clear the filters.'
              : 'Create a product first, then import the codes that belong to it.'
          }
          action={
            canManage ? (
              <Link className="btn primary sm" href="/enterprise/products/new">
                <Plus size={14} /> Create a product
              </Link>
            ) : undefined
          }
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>
              {products.length} {products.length === 1 ? 'product' : 'products'}
            </h3>
            <span className="small muted">Prices in QAR</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="num">Face value</th>
                    <th className="num">Selling price</th>
                    <th className="num">Commission</th>
                    <th className="num">Available</th>
                    <th className="num">Allocated</th>
                    <th className="num">Redeemed</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const count = counts.get(product.id) ?? { available: 0, allocated: 0, redeemed: 0 };
                    return (
                      <tr key={product.id}>
                        <td>
                          <span className="strong">{product.name}</span>
                          <br />
                          <span className="sub">{product.external_ref ?? 'No internal reference'}</span>
                        </td>
                        <td className="num">{formatMoney(Number(product.denomination_minor))}</td>
                        <td className="num">{formatMoney(Number(product.selling_price_minor))}</td>
                        <td className="num">{(Number(product.commission_bps) / 100).toFixed(2)}%</td>
                        <td className="num">{count.available}</td>
                        <td className="num">{count.allocated}</td>
                        <td className="num">{count.redeemed}</td>
                        <td>
                          <StatusTag status={product.is_active ? 'active' : 'draft'} />
                        </td>
                        <td className="small muted">{formatDate(product.created_at)}</td>
                        <td>
                          <div className="row-actions">
                            <Link className="btn sm" href={`/enterprise/products/${product.id}`}>
                              <Pencil size={14} /> Edit
                            </Link>
                            {canManage ? (
                              <form action={toggleEnterpriseProduct}>
                                <input type="hidden" name="product_id" value={product.id} />
                                <input type="hidden" name="active" value={product.is_active ? 'false' : 'true'} />
                                <button className="btn sm ghost" type="submit">
                                  <Power size={13} /> {product.is_active ? 'Pause' : 'Activate'}
                                </button>
                              </form>
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
