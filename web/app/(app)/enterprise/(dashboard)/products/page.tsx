import Link from 'next/link';
import { Pencil, Plus, Power, Search } from 'lucide-react';
import { requireEnterprise } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { toggleEnterpriseProduct } from '@/lib/actions/enterprise';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';
import { pick } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { enterpriseCopy } from '@/lib/i18n/enterprise';
import { getLocale } from '@/lib/i18n/server';

export default async function EnterpriseProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const t = pick(enterpriseCopy, locale).products;
  const c = pick(common, locale);
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
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
        actions={
          canManage ? (
            <Link className="btn sm primary" href="/enterprise/products/new">
              <Plus size={15} /> {t.newProduct}
            </Link>
          ) : undefined
        }
      />

      <Notice
        error={params.error}
        success={params.saved === '1' ? t.saved : null}
      />

      <form className="toolbar" action="/enterprise/products" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input name="q" defaultValue={params.q ?? ''} placeholder={t.searchPlaceholder} aria-label={t.searchLabel} />
        </div>
        <select name="status" defaultValue={status} aria-label={t.statusLabel}>
          <option value="">{t.allProducts}</option>
          <option value="active">{c.status.active}</option>
          <option value="paused">{t.paused}</option>
        </select>
        <button className="btn sm" type="submit">
          {c.actions.filter}
        </button>
        {q || status ? (
          <Link className="btn sm ghost" href="/enterprise/products">
            {c.actions.clear}
          </Link>
        ) : null}
      </form>

      {products.length === 0 ? (
        <EmptyState
          title={q || status ? t.noMatchTitle : t.emptyTitle}
          body={
            q || status
              ? t.noMatchBody
              : t.emptyBody
          }
          action={
            canManage ? (
              <Link className="btn primary sm" href="/enterprise/products/new">
                <Plus size={14} /> {t.createProduct}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>
              {products.length} {products.length === 1 ? t.product : t.products}
            </h3>
            <span className="small muted">{t.pricesInQar}</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.productTitle}</th>
                    <th className="num">{t.faceValue}</th>
                    <th className="num">{t.sellingPrice}</th>
                    <th className="num">{t.commission}</th>
                    <th className="num">{t.available}</th>
                    <th className="num">{t.allocated}</th>
                    <th className="num">{t.redeemed}</th>
                    <th>{c.labels.status}</th>
                    <th>{c.labels.created}</th>
                    <th style={{ textAlign: 'right' }}>{t.actions}</th>
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
                          <span className="sub">{product.external_ref ?? t.noInternalRef}</span>
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
                        <td className="small muted">{formatDate(product.created_at, locale)}</td>
                        <td>
                          <div className="row-actions">
                            <Link className="btn sm" href={`/enterprise/products/${product.id}`}>
                              <Pencil size={14} /> {c.actions.edit}
                            </Link>
                            {canManage ? (
                              <form action={toggleEnterpriseProduct}>
                                <input type="hidden" name="product_id" value={product.id} />
                                <input type="hidden" name="active" value={product.is_active ? 'false' : 'true'} />
                                <button className="btn sm ghost" type="submit">
                                  <Power size={13} /> {product.is_active ? t.pause : t.activate}
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
