import Link from 'next/link';
import { Plus, Pencil } from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';
import { setBulkOfferStatus } from '@/lib/actions/vendor';

export default async function VendorBulkProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireVendor();

  const { data, error } = await ctx.supabase
    .from('bulk_offers')
    .select('*, products(id,title), bulk_offer_price_tiers(*)')
    .eq('vendor_id', ctx.vendor.id)
    .order('created_at', { ascending: false });

  const offers = data ?? [];

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Bulk products"
        title="Exclusive bulk offers"
        description="Create discounted gift card offers visible only to approved business/bulk buyer accounts. Volume pricing tiers are applied automatically at checkout."
        actions={
          <Link className="btn sm primary" href="/vendor/bulk-products/new">
            <Plus size={15} /> New bulk offer
          </Link>
        }
      />

      <Notice error={params.error ?? error?.message} success={params.saved === '1' ? 'Saved.' : null} />

      {offers.length === 0 ? (
        <EmptyState
          title="No bulk offers yet"
          body="Create a bulk offer linked to one of your gift card products and set tiered pricing for corporate buyers."
          action={
            <Link className="btn primary sm" href="/vendor/bulk-products/new">
              <Plus size={14} /> Create bulk offer
            </Link>
          }
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>{offers.length} {offers.length === 1 ? 'offer' : 'offers'}</h3>
            <span className="small muted">Prices in QAR</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Offer</th>
                    <th>Linked product</th>
                    <th>Face / Bulk price</th>
                    <th>Min qty</th>
                    <th>Tiers</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((offer: any) => (
                    <tr key={offer.id}>
                      <td>
                        <span className="strong">{offer.title}</span>
                        <br />
                        <span className="sub">{offer.description || '—'}</span>
                      </td>
                      <td>{offer.products?.title ?? '—'}</td>
                      <td>
                        {formatMoney(offer.face_value_minor)} / {formatMoney(offer.base_unit_price_minor)}
                      </td>
                      <td>{offer.min_quantity}</td>
                      <td>{(offer.bulk_offer_price_tiers ?? []).length || 'Base only'}</td>
                      <td><StatusTag status={offer.status} /></td>
                      <td>
                        <div className="row-actions">
                          <Link className="btn sm" href={`/vendor/bulk-products/${offer.id}`}>
                            <Pencil size={14} /> Edit
                          </Link>
                          {offer.status !== 'active' ? (
                            <form action={setBulkOfferStatus}>
                              <input type="hidden" name="offer_id" value={offer.id} />
                              <input type="hidden" name="status" value="active" />
                              <button className="btn sm primary" type="submit">Enable</button>
                            </form>
                          ) : (
                            <form action={setBulkOfferStatus}>
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
