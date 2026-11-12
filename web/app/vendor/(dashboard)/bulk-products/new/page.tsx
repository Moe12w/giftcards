import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { createBulkOffer } from '@/lib/actions/vendor';
import { Notice, PageHead } from '@/components/ui';

function tiersToText(tiers: any[] | null | undefined) {
  return (tiers ?? [])
    .map((t) => `${t.min_quantity}${t.max_quantity ? `-${t.max_quantity}` : '+'}|${(Number(t.unit_price_minor) / 100).toFixed(2)}`)
    .join('\n');
}

export default async function NewBulkOfferPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireVendor();

  const { data: products } = await ctx.supabase
    .from('products')
    .select('id, title, fulfilment_type, status')
    .eq('vendor_id', ctx.vendor.id)
    .in('status', ['draft', 'published'])
    .order('title');

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Bulk products"
        title="Create a bulk offer"
        description="Link this offer to an existing gift card product. Bulk pricing and tiers are visible only to approved business/bulk buyer accounts."
        actions={
          <Link className="btn sm ghost" href="/vendor/bulk-products">
            <ArrowLeft size={15} /> Back
          </Link>
        }
      />

      <Notice error={params.error} />

      <form action={createBulkOffer} className="form card" style={{ padding: 20, display: 'grid', gap: 16 }}>
        <div className="field">
          <label htmlFor="product_id">Underlying gift card/product</label>
          <select id="product_id" name="product_id" required defaultValue="">
            <option value="" disabled>Select a product</option>
            {(products ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.fulfilment_type}, {p.status})
              </option>
            ))}
          </select>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="title">Offer title</label>
            <input id="title" name="title" required placeholder="Corporate bulk — 100 QAR gift card" />
          </div>
          <div className="field">
            <label htmlFor="image_url">Image URL (optional)</label>
            <input id="image_url" name="image_url" placeholder="https://…" />
          </div>
        </div>

        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea id="description" name="description" placeholder="What this bulk offer includes, redemption conditions, etc." />
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="face_value">Gift card face value (QAR)</label>
            <input id="face_value" name="face_value" required inputMode="decimal" placeholder="100.00" />
          </div>
          <div className="field">
            <label htmlFor="base_unit_price">Bulk selling price per card (QAR)</label>
            <input id="base_unit_price" name="base_unit_price" required inputMode="decimal" placeholder="85.00" />
          </div>
          <div className="field">
            <label htmlFor="min_quantity">Minimum purchase quantity</label>
            <input id="min_quantity" name="min_quantity" type="number" min={1} defaultValue={50} />
          </div>
          <div className="field">
            <label htmlFor="max_quantity">Maximum purchase quantity (optional)</label>
            <input id="max_quantity" name="max_quantity" type="number" min={1} />
          </div>
          <div className="field">
            <label htmlFor="available_quantity">Available inventory (optional)</label>
            <input id="available_quantity" name="available_quantity" type="number" min={0} />
          </div>
          <div className="field">
            <label htmlFor="expires_at">Gift card expiration date (optional)</label>
            <input id="expires_at" name="expires_at" type="date" />
          </div>
          <div className="field">
            <label htmlFor="starts_at">Offer start (optional)</label>
            <input id="starts_at" name="starts_at" type="datetime-local" />
          </div>
          <div className="field">
            <label htmlFor="ends_at">Offer end (optional)</label>
            <input id="ends_at" name="ends_at" type="datetime-local" />
          </div>
        </div>

        <div className="field">
          <label htmlFor="tiers">Volume pricing tiers (optional)</label>
          <textarea
            id="tiers"
            name="tiers"
            placeholder={'10-49|90.00\n50-99|85.00\n100-499|80.00\n500+|75.00'}
            rows={5}
          />
          <span className="hint">One per line: min-max|price per card (QAR). Use 500+ for open-ended. The correct tier is applied automatically by quantity.</span>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="min_order_value">Minimum order value QAR (optional)</label>
            <input id="min_order_value" name="min_order_value" inputMode="decimal" />
          </div>
          <div className="field">
            <label htmlFor="max_order_value">Maximum order value QAR (optional)</label>
            <input id="max_order_value" name="max_order_value" inputMode="decimal" />
          </div>
        </div>

        <div className="field">
          <label htmlFor="additional_conditions">Additional conditions/restrictions</label>
          <textarea id="additional_conditions" name="additional_conditions" placeholder="Any special purchasing conditions…" />
        </div>

        <label className="checkbox-row">
          <input type="checkbox" name="delivered_digitally" defaultChecked /> Delivered digitally
        </label>
        <label className="checkbox-row">
          <input type="checkbox" name="publish" /> Publish/enable this bulk offer now
        </label>

        <div className="btn-row">
          <button className="btn primary" type="submit">Create bulk offer</button>
          <Link className="btn ghost" href="/vendor/bulk-products">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
