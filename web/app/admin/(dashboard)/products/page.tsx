import Link from 'next/link';
import { Package, Search, ShoppingBag } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { adminSetProductStatus } from '@/lib/actions/admin';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { fulfilmentLabel } from '@/lib/catalog';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';

const TYPES = ['monetary', 'experience', 'enterprise_code'];

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string; vendor?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const q = (params.q ?? '').trim().toLowerCase();
  const status = params.status ?? '';
  const type = params.type ?? '';
  const vendorFilter = params.vendor ?? '';

  const [productsResult, vendorsResult] = await Promise.all([
    ctx.supabase
      .from('products')
      .select(
        'id, title, slug, fulfilment_type, status, is_active, min_amount_minor, max_amount_minor, preset_amounts_minor, session_count, created_at, vendor_id, enterprise_product_id, vendors(id, name, slug), enterprise_products(id, name, partner_id, enterprise_partners(name))',
      )
      .order('created_at', { ascending: false })
      .limit(2000),
    ctx.supabase.from('vendors').select('id, name').order('name'),
  ]);

  const error = productsResult.error ?? vendorsResult.error ?? null;

  const allProducts = productsResult.data ?? [];
  const vendors = vendorsResult.data ?? [];

  const products = allProducts.filter((product) => {
    if (status && product.status !== status) return false;
    if (type && product.fulfilment_type !== type) return false;
    if (vendorFilter && product.vendor_id !== vendorFilter) return false;
    if (!q) return true;
    const vendor = Array.isArray(product.vendors) ? product.vendors[0] : product.vendors;
    const enterpriseProduct = Array.isArray(product.enterprise_products)
      ? product.enterprise_products[0]
      : product.enterprise_products;
    return [product.title, product.slug, vendor?.name, enterpriseProduct?.name]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const published = allProducts.filter((product) => product.status === 'published').length;
  const experience = allProducts.filter((product) => product.fulfilment_type === 'experience').length;
  const enterprise = allProducts.filter((product) => product.fulfilment_type === 'enterprise_code').length;

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Catalogue"
        title="Products"
        description="Every gift on the marketplace, whether it comes from a vendor or a corporate reward programme."
      />

      <Notice error={params.error ?? error?.message} success={params.saved === '1' ? 'Product updated.' : null} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon">
            <ShoppingBag size={17} />
          </span>
          <strong>{allProducts.length}</strong>
          <span>All products</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
            <ShoppingBag size={17} />
          </span>
          <strong>{published}</strong>
          <span>Published</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--lavender-soft)' }}>
            <Package size={17} />
          </span>
          <strong>{experience}</strong>
          <span>Experience packages</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <Package size={17} />
          </span>
          <strong>{enterprise}</strong>
          <span>Corporate codes</span>
        </div>
      </div>

      <form className="toolbar" action="/admin/products" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input name="q" defaultValue={params.q ?? ''} placeholder="Gift, vendor or slug…" aria-label="Search products" />
        </div>
        <select name="vendor" defaultValue={vendorFilter} aria-label="Vendor">
          <option value="">All vendors</option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}
            </option>
          ))}
        </select>
        <select name="type" defaultValue={type} aria-label="Fulfilment type">
          <option value="">All types</option>
          {TYPES.map((value) => (
            <option key={value} value={value}>
              {fulfilmentLabel(value)}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} aria-label="Product status">
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <button className="btn sm" type="submit">
          Filter
        </button>
        {q || status || type || vendorFilter ? (
          <Link className="btn sm ghost" href="/admin/products">
            Clear
          </Link>
        ) : null}
      </form>

      {products.length === 0 ? (
        <EmptyState
          title={q || status || type || vendorFilter ? 'No products match' : 'No products yet'}
          body={
            q || status || type || vendorFilter
              ? 'Try a different search or clear the filters.'
              : 'Vendor and enterprise products will appear here once they are created.'
          }
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>
              {products.length} {products.length === 1 ? 'product' : 'products'}
            </h3>
            <span className="small muted">Newest first</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Gift</th>
                    <th>Owner</th>
                    <th>Type</th>
                    <th className="num">Price</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th style={{ textAlign: 'right' }}>Change status</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const vendor = Array.isArray(product.vendors) ? product.vendors[0] : product.vendors;
                    const enterpriseProduct = Array.isArray(product.enterprise_products)
                      ? product.enterprise_products[0]
                      : product.enterprise_products;
                    const partner = enterpriseProduct
                      ? Array.isArray(enterpriseProduct.enterprise_partners)
                        ? enterpriseProduct.enterprise_partners[0]
                        : enterpriseProduct.enterprise_partners
                      : null;
                    return (
                      <tr key={product.id}>
                        <td>
                          <span className="strong">{product.title}</span>
                          <br />
                          <span className="sub mono">{product.slug}</span>
                        </td>
                        <td className="small">
                          {vendor ? (
                            <Link href={`/admin/vendors/${vendor.id}`} style={{ textDecoration: 'underline' }}>
                              {vendor.name}
                            </Link>
                          ) : partner ? (
                            `${partner.name} · ${enterpriseProduct?.name ?? 'Reward'}`
                          ) : (
                            'Giftly'
                          )}
                        </td>
                        <td>
                          <span className="tag">{fulfilmentLabel(product.fulfilment_type)}</span>
                        </td>
                        <td className="num">
                          {product.min_amount_minor === product.max_amount_minor
                            ? formatMoney(Number(product.min_amount_minor))
                            : `${formatMoney(Number(product.min_amount_minor))} – ${formatMoney(Number(product.max_amount_minor))}`}
                        </td>
                        <td>
                          <StatusTag status={product.status} />
                        </td>
                        <td className="small muted">{formatDate(product.created_at)}</td>
                        <td>
                          <form action={adminSetProductStatus} className="inline-role" style={{ justifyContent: 'flex-end' }}>
                            <input type="hidden" name="product_id" value={product.id} />
                            <input type="hidden" name="return_to" value="/admin/products" />
                            <select name="status" defaultValue={product.status} aria-label={`Status for ${product.title}`}>
                              <option value="draft">Draft</option>
                              <option value="published">Published</option>
                              <option value="archived">Archived</option>
                            </select>
                            <button className="btn sm" type="submit">
                              Save
                            </button>
                          </form>
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
