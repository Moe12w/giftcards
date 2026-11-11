import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Archive, ArrowLeft, Plus, Power } from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { mapProduct } from '@/lib/data';
import { addProductVariant, setProductStatus, toggleProductVariant, updateProduct } from '@/lib/actions/vendor';
import { ProductForm } from '@/components/ProductForm';
import { Notice, PageHead, StatusTag } from '@/components/ui';
import { formatMoney } from '@/lib/money';

export default async function EditVendorProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const ctx = await requireVendor();

  const { data } = await ctx.supabase
    .from('products')
    .select('*, product_variants(*)')
    .eq('id', id)
    .eq('vendor_id', ctx.vendor.id)
    .maybeSingle();

  const product = mapProduct(data);
  if (!product) notFound();

  const { data: categories } = await ctx.supabase
    .from('categories')
    .select('id, name')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  const variants = (product.variants ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.price_minor - b.price_minor);

  return (
    <div className="dash-content">
      <Link className="back-link" href="/vendor/products">
        <ArrowLeft size={15} /> Back to gifts
      </Link>
      <PageHead
        eyebrow={product.fulfilment_type === 'experience' ? 'Experience gift' : 'Gift card'}
        title={product.title}
        description="Edit the details customers see. Published changes go live immediately."
        actions={
          <>
            <StatusTag status={product.status} />
            <Link className="btn sm" href={`/vendors/${ctx.vendor.slug ?? ctx.vendor.id}`} target="_blank">
              View storefront
            </Link>
          </>
        }
      />

      <Notice error={query.error} success={query.saved === '1' ? 'Saved.' : null} />

      <ProductForm
        action={updateProduct}
        product={product}
        categories={(categories ?? []) as { id: string; name: string }[]}
        mode="edit"
      />

      {product.fulfilment_type === 'experience' ? (
        <section className="panel">
          <div className="panel-head">
            <h3>Packages</h3>
            <span className="tag lavender">{variants.filter((variant) => variant.active).length} active</span>
          </div>
          <div className="panel-body">
            {variants.length === 0 ? (
              <div className="callout warn">
                This experience has no packages, so customers cannot buy it. Add at least one below.
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Package</th>
                      <th>Sessions</th>
                      <th className="num">Price</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((variant) => (
                      <tr key={variant.id}>
                        <td className="strong">{variant.label}</td>
                        <td>{variant.session_count ?? '—'}</td>
                        <td className="num">{formatMoney(variant.price_minor)}</td>
                        <td>
                          <StatusTag status={variant.active ? 'active' : 'draft'} />
                        </td>
                        <td>
                          <div className="row-actions">
                            <form action={toggleProductVariant}>
                              <input type="hidden" name="variant_id" value={variant.id} />
                              <input type="hidden" name="product_id" value={product.id} />
                              <input type="hidden" name="active" value={variant.active ? 'false' : 'true'} />
                              <button className="btn sm" type="submit">
                                <Power size={13} /> {variant.active ? 'Pause' : 'Activate'}
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <form action={addProductVariant} className="inline-form" style={{ marginTop: 18 }}>
              <input type="hidden" name="product_id" value={product.id} />
              <div className="field">
                <label htmlFor="label">New package label</label>
                <input id="label" name="label" required placeholder="Three-visit reset" />
              </div>
              <div className="field">
                <label htmlFor="sessions">Sessions</label>
                <input id="sessions" name="sessions" inputMode="numeric" placeholder="3" />
              </div>
              <div className="field">
                <label htmlFor="price">Price (QAR)</label>
                <input id="price" name="price" inputMode="decimal" required placeholder="600.00" />
              </div>
              <button className="btn primary" type="submit">
                <Plus size={15} /> Add package
              </button>
            </form>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-head">
          <h3>Danger zone</h3>
        </div>
        <div className="panel-body" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px' }}>
            <strong>Archive this gift</strong>
            <p className="small muted">
              Archiving hides it from customers. Existing vouchers keep working and can still be
              redeemed.
            </p>
          </div>
          <form action={setProductStatus}>
            <input type="hidden" name="product_id" value={product.id} />
            <input type="hidden" name="status" value="archived" />
            <input type="hidden" name="return_to" value="/vendor/products" />
            <button className="btn sm coral" type="submit">
              <Archive size={14} /> Archive
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
