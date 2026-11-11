import Link from 'next/link';
import { Eye, Pencil, Plus, Search } from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { mapProducts } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { fulfilmentLabel, priceLabel } from '@/lib/catalog';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';
import { setProductStatus } from '@/lib/actions/vendor';

export default async function VendorProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; status?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireVendor();
  const q = (params.q ?? '').trim();
  const type = params.type ?? '';
  const status = params.status ?? '';

  let query = ctx.supabase
    .from('products')
    .select('*, product_variants(*)')
    .eq('vendor_id', ctx.vendor.id)
    .order('created_at', { ascending: false });

  if (q) query = query.ilike('title', `%${q}%`);
  if (type) query = query.eq('fulfilment_type', type);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  const products = mapProducts(data);

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Catalogue"
        title="Gifts"
        description="Gift cards use amounts; experience gifts use packages. Only published gifts are visible to customers."
        actions={
          <Link className="btn sm primary" href="/vendor/products/new">
            <Plus size={15} /> New gift
          </Link>
        }
      />

      <Notice error={params.error ?? error?.message} success={params.saved === '1' ? 'Saved.' : null} />

      <form className="toolbar" action="/vendor/products" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input name="q" defaultValue={q} placeholder="Search gifts…" aria-label="Search gifts" />
        </div>
        <select name="type" defaultValue={type} aria-label="Gift type">
          <option value="">All types</option>
          <option value="monetary">Gift cards</option>
          <option value="experience">Experiences</option>
        </select>
        <select name="status" defaultValue={status} aria-label="Status">
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <button className="btn sm" type="submit">
          Filter
        </button>
        {q || type || status ? (
          <Link className="btn sm ghost" href="/vendor/products">
            Clear
          </Link>
        ) : null}
      </form>

      {products.length === 0 ? (
        <EmptyState
          title={q || type || status ? 'No gifts match those filters' : 'Your catalogue is empty'}
          body={
            q || type || status
              ? 'Try a different search or clear the filters.'
              : 'Create your first gift card or experience package. It can stay in draft while you work on it.'
          }
          action={
            <Link className="btn primary sm" href="/vendor/products/new">
              <Plus size={14} /> Create a gift
            </Link>
          }
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>
              {products.length} {products.length === 1 ? 'gift' : 'gifts'}
            </h3>
            <span className="small muted">Prices in QAR</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Gift</th>
                    <th>Type</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <span className="strong">{product.title}</span>
                        <br />
                        <span className="sub">
                          {product.fulfilment_type === 'experience'
                            ? `${product.variants?.length ?? 0} active package${(product.variants?.length ?? 0) === 1 ? '' : 's'}`
                            : `QAR ${(product.min_amount_minor / 100).toFixed(0)} – ${(product.max_amount_minor / 100).toFixed(0)}`}
                        </span>
                      </td>
                      <td>
                        <span className="tag">{fulfilmentLabel(product.fulfilment_type)}</span>
                      </td>
                      <td>{priceLabel(product)}</td>
                      <td>
                        <StatusTag status={product.status} />
                      </td>
                      <td className="small muted">{formatDate(product.updated_at)}</td>
                      <td>
                        <div className="row-actions">
                          {product.status === 'published' ? (
                            <Link
                              className="btn sm ghost"
                              href={`/vendors/${ctx.vendor.slug ?? ctx.vendor.id}`}
                              target="_blank"
                              aria-label="View public page"
                            >
                              <Eye size={14} />
                            </Link>
                          ) : null}
                          <Link className="btn sm" href={`/vendor/products/${product.id}`}>
                            <Pencil size={14} /> Edit
                          </Link>
                          {product.status !== 'published' ? (
                            <form action={setProductStatus}>
                              <input type="hidden" name="product_id" value={product.id} />
                              <input type="hidden" name="status" value="published" />
                              <input type="hidden" name="return_to" value="/vendor/products" />
                              <button className="btn sm primary" type="submit">
                                Publish
                              </button>
                            </form>
                          ) : (
                            <form action={setProductStatus}>
                              <input type="hidden" name="product_id" value={product.id} />
                              <input type="hidden" name="status" value="draft" />
                              <input type="hidden" name="return_to" value="/vendor/products" />
                              <button className="btn sm" type="submit">
                                Unpublish
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
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
