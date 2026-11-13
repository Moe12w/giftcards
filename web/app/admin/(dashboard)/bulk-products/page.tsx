import Link from 'next/link';
import { Building2, Package } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';
import { adminSetBulkOfferStatus } from '@/lib/actions/admin';

export default async function AdminBulkProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const statusFilter = params.status ?? '';

  const { data: offers, error } = await ctx.supabase
    .from('bulk_offers')
    .select('*, vendors(id,name), products(id,title), bulk_offer_price_tiers(*)')
    .order('created_at', { ascending: false })
    .limit(500);

  const rows = (offers ?? []).filter((o: any) => !statusFilter || o.status === statusFilter);
  const active = (offers ?? []).filter((o: any) => o.status === 'active' && o.enabled).length;

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Corporate & bulk"
        title="Bulk products"
        description="Every bulk offer published by vendors and enterprise partners, with its pricing and tiers. Pause or remove an offer here."
      />
      <Notice error={params.error ?? error?.message} success={params.saved === '1' ? 'Saved.' : null} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon"><Package size={17} /></span>
          <strong>{(offers ?? []).length}</strong>
          <span>Bulk offers</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}><Package size={17} /></span>
          <strong>{active}</strong>
          <span>Live for business buyers</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--lavender-soft)' }}><Building2 size={17} /></span>
          <strong>{new Set((offers ?? []).map((o: any) => o.vendor_id).filter(Boolean)).size}</strong>
          <span>Vendors selling in bulk</span>
        </div>
      </div>

      <form className="toolbar" action="/admin/bulk-products" method="get">
        <select name="status" defaultValue={statusFilter} aria-label="Status">
          <option value="">All statuses</option>
          {['draft', 'active', 'paused', 'expired'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button className="btn sm" type="submit">Filter</button>
        {statusFilter ? <Link className="btn sm ghost" href="/admin/bulk-products">Clear</Link> : null}
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No bulk offers yet" body="Vendors and partners publish bulk offers from their own dashboards." />
      ) : (
        <section className="panel">
          <div className="panel-head"><h3>{rows.length} bulk offers</h3></div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Offer</th>
                    <th>Seller</th>
                    <th>Product</th>
                    <th className="num">Face / bulk</th>
                    <th className="num">Min qty</th>
                    <th className="num">Tiers</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o: any) => (
                    <tr key={o.id}>
                      <td>
                        <span className="strong">{o.title}</span>
                        <br />
                        <span className="sub">{o.description || '—'}</span>
                      </td>
                      <td className="small">{o.vendors?.name ?? 'Partner'}</td>
                      <td className="small">{o.products?.title ?? '—'}</td>
                      <td className="num">
                        {formatMoney(o.face_value_minor)} / {formatMoney(o.base_unit_price_minor)}
                      </td>
                      <td className="num">{o.min_quantity}</td>
                      <td className="num">{(o.bulk_offer_price_tiers ?? []).length}</td>
                      <td>
                        <div style={{ display: 'grid', gap: 4 }}>
                          <StatusTag status={o.status} />
                          {!o.enabled ? <span className="sub">hidden</span> : null}
                        </div>
                      </td>
                      <td>
                        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                          {o.status === 'active' ? (
                            <form action={adminSetBulkOfferStatus}>
                              <input type="hidden" name="offer_id" value={o.id} />
                              <input type="hidden" name="status" value="paused" />
                              <button className="btn sm" type="submit">Pause</button>
                            </form>
                          ) : (
                            <form action={adminSetBulkOfferStatus}>
                              <input type="hidden" name="offer_id" value={o.id} />
                              <input type="hidden" name="status" value="active" />
                              <input type="hidden" name="enabled" value="on" />
                              <button className="btn sm primary" type="submit">Publish</button>
                            </form>
                          )}
                          {o.status !== 'expired' ? (
                            <form action={adminSetBulkOfferStatus}>
                              <input type="hidden" name="offer_id" value={o.id} />
                              <input type="hidden" name="status" value="expired" />
                              <button className="btn sm ghost" type="submit">Remove</button>
                            </form>
                          ) : null}
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
