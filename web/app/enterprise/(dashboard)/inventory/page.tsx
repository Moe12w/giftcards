import Link from 'next/link';
import { Boxes, Search } from 'lucide-react';
import { requireEnterprise } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';
import type { InventoryStatus } from '@/lib/types';
import { pick } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { enterpriseCopy } from '@/lib/i18n/enterprise';
import { getLocale } from '@/lib/i18n/server';

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
  const locale = await getLocale();
  const t = pick(enterpriseCopy, locale).inventory;
  const c = pick(common, locale);
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
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
        actions={
          <Link className="btn sm primary" href="/enterprise/import">
            <Boxes size={15} /> {t.importCodes}
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
          <span>{t.available}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--lavender-soft)' }}>
            <Boxes size={17} />
          </span>
          <strong>{allocated.length}</strong>
          <span>{t.allocatedOrDelivered}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <Boxes size={17} />
          </span>
          <strong>{redeemed.length}</strong>
          <span>{t.confirmedRedeemed}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--coral-soft)' }}>
            <Boxes size={17} />
          </span>
          <strong>{formatMoney(availableValue)}</strong>
          <span>{t.availableFaceValue}</span>
        </div>
      </div>

      <form className="toolbar" action="/enterprise/inventory" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input name="q" defaultValue={params.q ?? ''} placeholder={t.searchPlaceholder} aria-label={t.searchLabel} />
        </div>
        <select name="product" defaultValue={productFilter} aria-label={t.productLabel}>
          <option value="">{t.allProducts}</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} aria-label={c.labels.status}>
          <option value="">{t.allStatuses}</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {t.statusLabels[value]}
            </option>
          ))}
        </select>
        <button className="btn sm" type="submit">
          {c.actions.filter}
        </button>
        {q || status || productFilter ? (
          <Link className="btn sm ghost" href="/enterprise/inventory">
            {c.actions.clear}
          </Link>
        ) : null}
      </form>

      {inventory.length === 0 ? (
        <EmptyState
          title={all.length === 0 ? t.emptyTitle : t.noMatchTitle}
          body={
            all.length === 0
              ? t.emptyBody
              : t.noMatchBody
          }
          action={
            all.length === 0 ? (
              <Link className="btn primary sm" href="/enterprise/import">
                {t.importCodes}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>
              {inventory.length} {inventory.length === 1 ? t.code : t.codes}
            </h3>
            <span className="small muted">{t.showingUpTo}</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.reference}</th>
                    <th>{t.productLabel}</th>
                    <th>{c.labels.code}</th>
                    <th className="num">{t.value}</th>
                    <th>{c.labels.status}</th>
                    <th>{t.allocated}</th>
                    <th>{t.delivered}</th>
                    <th>{t.redeemed}</th>
                    <th>{t.expires}</th>
                    <th>{t.imported}</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((item) => (
                    <tr key={item.inventory_id}>
                      <td className="strong mono small">{item.inventory_ref}</td>
                      <td>{productNames.get(item.enterprise_product_id) ?? t.productFallback}</td>
                      <td className="mono masked">{item.code_masked}</td>
                      <td className="num">{formatMoney(Number(item.denomination_minor))}</td>
                      <td>
                        <StatusTag status={item.status} />
                      </td>
                      <td className="small muted">{item.allocated_at ? formatDate(item.allocated_at, locale) : '—'}</td>
                      <td className="small muted">{item.delivered_at ? formatDate(item.delivered_at, locale) : '—'}</td>
                      <td className="small muted">
                        {item.confirmed_redeemed_at ? formatDate(item.confirmed_redeemed_at, locale) : '—'}
                      </td>
                      <td className="small muted">{item.expires_at ? formatDate(item.expires_at, locale) : t.noExpiry}</td>
                      <td className="small muted">{formatDate(item.created_at, locale)}</td>
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
