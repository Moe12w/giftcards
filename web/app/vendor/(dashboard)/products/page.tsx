import Link from 'next/link';
import { Eye, Pencil, Plus, Search } from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { mapProducts } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { fulfilmentLabel, priceLabel } from '@/lib/catalog';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';
import { setProductStatus } from '@/lib/actions/vendor';
import { pick } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { getLocale } from '@/lib/i18n/server';
import { vendorCopy } from '@/lib/i18n/vendor';

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
  const locale = await getLocale();
  const t = pick(vendorCopy, locale).products;
  const c = pick(common, locale);

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
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
        actions={
          <Link className="btn sm primary" href="/vendor/products/new">
            <Plus size={15} /> {t.newGift}
          </Link>
        }
      />

      <Notice error={params.error ?? error?.message} success={params.saved === '1' ? t.saved : null} />

      <form className="toolbar" action="/vendor/products" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input
            name="q"
            defaultValue={q}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchLabel}
          />
        </div>
        <select name="type" defaultValue={type} aria-label={t.typeLabel}>
          <option value="">{t.allTypes}</option>
          <option value="monetary">{t.giftCards}</option>
          <option value="experience">{t.experiences}</option>
        </select>
        <select name="status" defaultValue={status} aria-label={t.statusLabel}>
          <option value="">{t.allStatuses}</option>
          <option value="published">{c.status.published}</option>
          <option value="draft">{c.status.draft}</option>
          <option value="archived">{c.status.archived}</option>
        </select>
        <button className="btn sm" type="submit">
          {c.actions.filter}
        </button>
        {q || type || status ? (
          <Link className="btn sm ghost" href="/vendor/products">
            {c.actions.clear}
          </Link>
        ) : null}
      </form>

      {products.length === 0 ? (
        <EmptyState
          title={q || type || status ? t.noMatchTitle : t.emptyTitle}
          body={q || type || status ? t.noMatchBody : t.emptyBody}
          action={
            <Link className="btn primary sm" href="/vendor/products/new">
              <Plus size={14} /> {t.createGift}
            </Link>
          }
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>
              {products.length} {products.length === 1 ? t.gift : t.gifts}
            </h3>
            <span className="small muted">{t.pricesInQar}</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.giftTitle}</th>
                    <th>{c.labels.type}</th>
                    <th>{c.labels.price}</th>
                    <th>{c.labels.status}</th>
                    <th>{c.labels.updated}</th>
                    <th style={{ textAlign: 'right' }}>{t.actions}</th>
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
                            ? `${product.variants?.length ?? 0} ${(product.variants?.length ?? 0) === 1 ? t.activePackage : t.activePackages}`
                            : `QAR ${(product.min_amount_minor / 100).toFixed(0)} – ${(product.max_amount_minor / 100).toFixed(0)}`}
                        </span>
                      </td>
                      <td>
                        <span className="tag">{fulfilmentLabel(product.fulfilment_type, locale)}</span>
                      </td>
                      <td>{priceLabel(product, locale)}</td>
                      <td>
                        <StatusTag status={product.status} />
                      </td>
                      <td className="small muted">{formatDate(product.updated_at, locale)}</td>
                      <td>
                        <div className="row-actions">
                          {product.status === 'published' ? (
                            <Link
                              className="btn sm ghost"
                              href={`/vendors/${ctx.vendor.slug ?? ctx.vendor.id}`}
                              target="_blank"
                              aria-label={t.viewPublicPage}
                            >
                              <Eye size={14} />
                            </Link>
                          ) : null}
                          <Link className="btn sm" href={`/vendor/products/${product.id}`}>
                            <Pencil size={14} /> {c.actions.edit}
                          </Link>
                          {product.status !== 'published' ? (
                            <form action={setProductStatus}>
                              <input type="hidden" name="product_id" value={product.id} />
                              <input type="hidden" name="status" value="published" />
                              <input type="hidden" name="return_to" value="/vendor/products" />
                              <button className="btn sm primary" type="submit">
                                {t.publish}
                              </button>
                            </form>
                          ) : (
                            <form action={setProductStatus}>
                              <input type="hidden" name="product_id" value={product.id} />
                              <input type="hidden" name="status" value="draft" />
                              <input type="hidden" name="return_to" value="/vendor/products" />
                              <button className="btn sm" type="submit">
                                {t.unpublish}
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
