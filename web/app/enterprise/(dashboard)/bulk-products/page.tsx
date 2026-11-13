import Link from 'next/link';
import { Package, Pencil, Plus } from 'lucide-react';
import { requireEnterprise } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';
import { setPartnerBulkOfferStatus } from '@/lib/actions/enterprise';

export default async function EnterpriseBulkProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireEnterprise();

  const { data: offers, error } = await ctx.supabase
    .from('bulk_offers')
    .select('*, products(id,title), bulk_offer_price_tiers(*)')
    .eq('partner_id', ctx.partner.id)
    .order('created_at', { ascending: false });

  const rows = offers ?? [];
  const active = rows.filter((o: any) => o.status === 'active' && o.enabled).length;

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Bulk products"
        title="Corporate bulk offers"
        description="Publish bulk pricing for your rewards so approved business buyers can order in volume. Volume tiers are applied automatically at checkout."
        actions={
          <Link className="btn sm primary" href="/enterprise/bulk-products/new">
            <Plus size={15} /> New bulk offer
          </Link>
        }
      />
      <Notice error={params.error ?? error?.message} success={params.saved === '1' ? 'Saved.' : null} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon"><Package size={17} /></span>
          <strong>{rows.length}</strong>
          <span>Bulk offers</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}><Package size={17} /></span>
          <strong>{active}</strong>
          <span>Live for business buyers</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}><Package size={17} /></span>
          <strong>{rows.reduce((sum: number, o: any) => sum + Number(o.available_quantity ?? 0), 0)}</strong>
          <span>Cards available</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No bulk offers yet"
          body="Create a bulk offer from one of your products and set the corporate price and volume tiers."
          action={
            <Link className="btn primary sm" href="/enterprise/bulk-products/new">
              <Plus size={14} /> Create bulk offer
            </Link>
          }
        />
      ) : (
        <section className="panel">
          <div className="panel-head"><h3>{rows.length} bulk offers</h3></div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Offer</th>
                    <th>Product</th>
                    <th className="num">Face / bulk price</th>
                    <th className="num">Min qty</th>
                    <th className="num">Tiers</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((offer: any) => (
                    <tr key={offer.id}>
                      <td>
                        <span className="strong">{offer.title}</span>
                        <br />
                        <span className="sub">{offer.description || '—'}</span>
                      </td>
                      <td>{offer.products?.title ?? '—'}</td>
                      <td className="num">
                        {formatMoney(offer.face_value_minor)} / {formatMoney(offer.base_unit_price_minor)}
                      </td>
                      <td className="num">{offer.min_quantity}</td>
                      <td className="num">{(offer.bulk_offer_price_tiers ?? []).length || 'Base only'}</td>
                      <td><StatusTag status={offer.status} /></td>
                      <td>
                        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                          <Link className="btn sm" href={`/enterprise/bulk-products/${offer.id}`}>
                            <Pencil size={14} /> Edit
                          </Link>
                          {offer.status !== 'active' ? (
                            <form action={setPartnerBulkOfferStatus}>
                              <input type="hidden" name="offer_id" value={offer.id} />
                              <input type="hidden" name="status" value="active" />
                              <button className="btn sm primary" type="submit">Publish</button>
                            </form>
                          ) : (
                            <form action={setPartnerBulkOfferStatus}>
                              <input type="hidden" name="offer_id" value={offer.id} />
                              <input type="hidden" name="status" value="paused" />
                              <button className="btn sm" type="submit">Pause</button>
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
