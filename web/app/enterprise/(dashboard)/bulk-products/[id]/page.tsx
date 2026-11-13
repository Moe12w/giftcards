import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { requireEnterprise } from '@/lib/auth';
import { updatePartnerBulkOffer, setPartnerBulkOfferStatus } from '@/lib/actions/enterprise';
import { tiersToText } from '@/lib/bulk';
import { Notice, PageHead } from '@/components/ui';

export default async function EditPartnerBulkOfferPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireEnterprise();

  const { data: offer } = await ctx.supabase
    .from('bulk_offers')
    .select('*, products(id,title), bulk_offer_price_tiers(*)')
    .eq('id', id)
    .eq('partner_id', ctx.partner.id)
    .maybeSingle();

  if (!offer) notFound();

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Bulk products"
        title={offer.title}
        description="Edit this bulk offer. Changes apply to future purchases; historical orders keep their agreed pricing."
        actions={
          <Link className="btn sm ghost" href="/enterprise/bulk-products">
            <ArrowLeft size={15} /> Back
          </Link>
        }
      />
      <Notice error={sp.error} success={sp.saved === '1' ? 'Saved.' : null} />

      <div className="btn-row" style={{ marginBottom: 16 }}>
        {offer.status === 'active' ? (
          <form action={setPartnerBulkOfferStatus}>
            <input type="hidden" name="offer_id" value={offer.id} />
            <input type="hidden" name="status" value="paused" />
            <button className="btn sm" type="submit">Pause offer</button>
          </form>
        ) : (
          <form action={setPartnerBulkOfferStatus}>
            <input type="hidden" name="offer_id" value={offer.id} />
            <input type="hidden" name="status" value="active" />
            <button className="btn sm primary" type="submit">Publish offer</button>
          </form>
        )}
      </div>

      <form action={updatePartnerBulkOffer} className="form card" style={{ padding: 20, display: 'grid', gap: 16 }}>
        <input type="hidden" name="offer_id" value={offer.id} />

        <div className="callout info">
          Linked product: <strong>{offer.products?.title ?? offer.product_id}</strong> (cannot be changed after creation)
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="title">Offer title</label>
            <input id="title" name="title" required defaultValue={offer.title} />
          </div>
          <div className="field">
            <label htmlFor="image_url">Image URL (optional)</label>
            <input id="image_url" name="image_url" defaultValue={offer.image_url ?? ''} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea id="description" name="description" defaultValue={offer.description ?? ''} />
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="face_value">Gift card face value (QAR)</label>
            <input id="face_value" name="face_value" required inputMode="decimal" defaultValue={(offer.face_value_minor / 100).toFixed(2)} />
          </div>
          <div className="field">
            <label htmlFor="base_unit_price">Bulk selling price per card (QAR)</label>
            <input id="base_unit_price" name="base_unit_price" required inputMode="decimal" defaultValue={(offer.base_unit_price_minor / 100).toFixed(2)} />
          </div>
          <div className="field">
            <label htmlFor="min_quantity">Minimum purchase quantity</label>
            <input id="min_quantity" name="min_quantity" type="number" min={1} defaultValue={offer.min_quantity} />
          </div>
          <div className="field">
            <label htmlFor="max_quantity">Maximum purchase quantity (optional)</label>
            <input id="max_quantity" name="max_quantity" type="number" min={1} defaultValue={offer.max_quantity ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="available_quantity">Available inventory (optional)</label>
            <input id="available_quantity" name="available_quantity" type="number" min={0} defaultValue={offer.available_quantity ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="expires_at">Gift card expiration date (optional)</label>
            <input id="expires_at" name="expires_at" type="date" defaultValue={offer.expires_at ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="starts_at">Offer start (optional)</label>
            <input id="starts_at" name="starts_at" type="datetime-local" defaultValue={offer.starts_at ? offer.starts_at.slice(0, 16) : ''} />
          </div>
          <div className="field">
            <label htmlFor="ends_at">Offer end (optional)</label>
            <input id="ends_at" name="ends_at" type="datetime-local" defaultValue={offer.ends_at ? offer.ends_at.slice(0, 16) : ''} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="tiers">Volume pricing tiers (optional)</label>
          <textarea id="tiers" name="tiers" rows={5} defaultValue={tiersToText(offer.bulk_offer_price_tiers)} />
          <span className="hint">One per line: min-max|price per card (QAR). Use 500+ for open-ended.</span>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="min_order_value">Minimum order value QAR (optional)</label>
            <input id="min_order_value" name="min_order_value" inputMode="decimal" defaultValue={offer.min_order_value_minor != null ? (offer.min_order_value_minor / 100).toFixed(2) : ''} />
          </div>
          <div className="field">
            <label htmlFor="max_order_value">Maximum order value QAR (optional)</label>
            <input id="max_order_value" name="max_order_value" inputMode="decimal" defaultValue={offer.max_order_value_minor != null ? (offer.max_order_value_minor / 100).toFixed(2) : ''} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="additional_conditions">Additional conditions/restrictions</label>
          <textarea id="additional_conditions" name="additional_conditions" defaultValue={offer.additional_conditions ?? ''} />
        </div>

        <label className="checkbox-row">
          <input type="checkbox" name="delivered_digitally" defaultChecked={offer.delivered_digitally} /> Delivered digitally
        </label>

        <div className="btn-row">
          <button className="btn primary" type="submit">Save changes</button>
          <Link className="btn ghost" href="/enterprise/bulk-products">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
