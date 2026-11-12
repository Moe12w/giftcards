import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Archive, ArrowLeft, Plus, Power } from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { mapProduct } from '@/lib/data';
import { addProductVariant, setProductStatus, toggleProductVariant, updateProduct } from '@/lib/actions/vendor';
import { ProductForm } from '@/components/ProductForm';
import { Notice, PageHead, StatusTag } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import { fill, pick } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { getLocale } from '@/lib/i18n/server';
import { vendorCopy } from '@/lib/i18n/vendor';

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
  const locale = await getLocale();
  const t = pick(vendorCopy, locale).productDetail;
  const c = pick(common, locale);

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
        <ArrowLeft size={15} /> {t.backToGifts}
      </Link>
      <PageHead
        eyebrow={product.fulfilment_type === 'experience' ? t.experienceGift : t.giftCard}
        title={product.title}
        description={t.description}
        actions={
          <>
            <StatusTag status={product.status} />
            <Link className="btn sm" href={`/vendors/${ctx.vendor.slug ?? ctx.vendor.id}`} target="_blank">
              {t.viewStorefront}
            </Link>
          </>
        }
      />

      <Notice error={query.error} success={query.saved === '1' ? t.saved : null} />

      <ProductForm
        action={updateProduct}
        product={product}
        categories={(categories ?? []) as { id: string; name: string }[]}
        mode="edit"
      />

      {product.fulfilment_type === 'experience' ? (
        <section className="panel">
          <div className="panel-head">
            <h3>{t.packages}</h3>
            <span className="tag lavender">
              {fill(t.activeCount, { count: variants.filter((variant) => variant.active).length })}
            </span>
          </div>
          <div className="panel-body">
            {variants.length === 0 ? (
              <div className="callout warn">{t.noPackages}</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t.packageHeader}</th>
                      <th>{t.sessions}</th>
                      <th className="num">{c.labels.price}</th>
                      <th>{c.labels.status}</th>
                      <th style={{ textAlign: 'right' }}>{t.actions}</th>
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
                                <Power size={13} /> {variant.active ? t.pause : t.activate}
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
                <label htmlFor="label">{t.newPackageLabel}</label>
                <input id="label" name="label" required placeholder={t.packagePlaceholder} />
              </div>
              <div className="field">
                <label htmlFor="sessions">{t.sessionsField}</label>
                <input id="sessions" name="sessions" inputMode="numeric" placeholder="3" />
              </div>
              <div className="field">
                <label htmlFor="price">{t.priceField}</label>
                <input id="price" name="price" inputMode="decimal" required placeholder="600.00" />
              </div>
              <button className="btn primary" type="submit">
                <Plus size={15} /> {t.addPackage}
              </button>
            </form>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-head">
          <h3>{t.dangerZone}</h3>
        </div>
        <div className="panel-body" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px' }}>
            <strong>{t.archiveGift}</strong>
            <p className="small muted">{t.archiveHint}</p>
          </div>
          <form action={setProductStatus}>
            <input type="hidden" name="product_id" value={product.id} />
            <input type="hidden" name="status" value="archived" />
            <input type="hidden" name="return_to" value="/vendor/products" />
            <button className="btn sm coral" type="submit">
              <Archive size={14} /> {t.archive}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
