import { ArrowRight, Boxes } from 'lucide-react';
import type { EnterpriseProduct } from '@/lib/types';
import { minorToInput } from '@/lib/money';

export function EnterpriseProductForm({
  action,
  product,
}: {
  action: (formData: FormData) => void | Promise<void>;
  product?: EnterpriseProduct | null;
}) {
  return (
    <form action={action} className="card" style={{ display: 'grid', gap: 18 }}>
      {product ? <input type="hidden" name="product_id" value={product.id} /> : null}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="name">Product name</label>
          <input id="name" name="name" required defaultValue={product?.name ?? ''} placeholder="QAR 250 Giftly reward" />
        </div>
        <div className="field">
          <label htmlFor="external_ref">Internal reference</label>
          <input id="external_ref" name="external_ref" defaultValue={product?.external_ref ?? ''} placeholder="HR-2026-Q1" />
        </div>
        <div className="field">
          <label htmlFor="denomination">Face value of one code (QAR)</label>
          <input
            id="denomination"
            name="denomination"
            inputMode="decimal"
            required
            defaultValue={product ? minorToInput(product.denomination_minor) : '250.00'}
            placeholder="250.00"
          />
          <span className="hint">What one of your codes is worth in your own app.</span>
        </div>
        <div className="field">
          <label htmlFor="selling_price">Price the customer pays (QAR)</label>
          <input
            id="selling_price"
            name="selling_price"
            inputMode="decimal"
            required
            defaultValue={product ? minorToInput(product.selling_price_minor) : '250.00'}
            placeholder="250.00"
          />
          <span className="hint">You set this. It is what the gift costs in the app.</span>
        </div>
        <div className="field">
          <label htmlFor="commission_percent">Giftly&apos;s cut (%)</label>
          <input
            id="commission_percent"
            name="commission_percent"
            inputMode="decimal"
            defaultValue={product ? (product.commission_bps / 100).toString() : '10'}
            placeholder="10"
          />
          <span className="hint">Our share of every code that sells. You keep the rest.</span>
        </div>
        <div className="field">
          <label htmlFor="expiry_days">Code validity (days)</label>
          <input
            id="expiry_days"
            name="expiry_days"
            inputMode="numeric"
            defaultValue={product?.expiry_days ?? ''}
            placeholder="365"
          />
          <span className="hint">Leave blank if codes do not expire.</span>
        </div>
        <div className="field">
          <label htmlFor="is_active">Availability</label>
          <label className="checkbox-row">
            <input type="checkbox" name="is_active" defaultChecked={product?.is_active ?? true} />
            Active and available for allocation
          </label>
        </div>
        <div className="field full">
          <label htmlFor="terms_and_conditions">Terms and conditions</label>
          <textarea
            id="terms_and_conditions"
            name="terms_and_conditions"
            defaultValue={product?.terms_and_conditions ?? ''}
            placeholder="Anything the recipient should know before using the code."
          />
        </div>
        <div className="field full">
          <label htmlFor="redemption_instructions">Redemption instructions</label>
          <textarea
            id="redemption_instructions"
            name="redemption_instructions"
            defaultValue={product?.redemption_instructions ?? ''}
            placeholder="How the recipient redeems the code with the vendor."
          />
        </div>
      </div>

      <div className="btn-row">
        <button className="btn lavender" type="submit">
          <Boxes size={16} /> {product ? 'Save product' : 'Create product'} <ArrowRight size={16} />
        </button>
        <span className="small muted">
          Products hold the rules; individual codes are imported into inventory.
        </span>
      </div>
    </form>
  );
}
