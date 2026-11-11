'use client';

import { useState } from 'react';
import { ArrowRight, CalendarHeart, Gift } from 'lucide-react';
import type { Product } from '@/lib/types';
import { minorToInput } from '@/lib/money';
import { normalizeTone } from '@/lib/catalog';

export function ProductForm({
  action,
  product,
  categories,
  mode,
}: {
  action: (formData: FormData) => void | Promise<void>;
  product?: Product | null;
  categories: { id: string; name: string }[];
  mode: 'create' | 'edit';
}) {
  const [type, setType] = useState<'monetary' | 'experience'>(
    product?.fulfilment_type === 'experience' ? 'experience' : 'monetary',
  );

  return (
    <form action={action} className="card" style={{ display: 'grid', gap: 18 }}>
      {product ? <input type="hidden" name="product_id" value={product.id} /> : null}

      <div className="form-grid">
        <div className="field full">
          <label htmlFor="title">Gift title</label>
          <input
            id="title"
            name="title"
            required
            defaultValue={product?.title ?? ''}
            placeholder="Weekend coffee for two"
          />
        </div>
        <div className="field">
          <label htmlFor="title_ar">Arabic title (optional)</label>
          <input id="title_ar" name="title_ar" defaultValue={product?.title_ar ?? ''} dir="rtl" />
        </div>
        <div className="field">
          <label htmlFor="category_id">Category</label>
          <select id="category_id" name="category_id" defaultValue={product?.category_id ?? ''}>
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field full">
          <label htmlFor="description">Short description</label>
          <textarea
            id="description"
            name="description"
            defaultValue={product?.description ?? ''}
            placeholder="What is included, and why it is a lovely gift."
          />
        </div>

        <div className="field">
          <label htmlFor="fulfilment_type">Gift type</label>
          {mode === 'create' ? (
            <select
              id="fulfilment_type"
              name="fulfilment_type"
              value={type}
              onChange={(event) => setType(event.target.value as 'monetary' | 'experience')}
            >
              <option value="monetary">Gift card (any amount)</option>
              <option value="experience">Experience (packages)</option>
            </select>
          ) : (
            <>
              <input type="hidden" name="fulfilment_type" value={type} />
              <div className="callout info" style={{ boxShadow: 'none' }}>
                {type === 'experience' ? (
                  <>
                    <CalendarHeart size={15} style={{ display: 'inline', verticalAlign: '-2px' }} />{' '}
                    Experience gift — pricing comes from the packages below.
                  </>
                ) : (
                  <>
                    <Gift size={15} style={{ display: 'inline', verticalAlign: '-2px' }} /> Gift card
                    — customers choose an amount between the limits.
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={product?.status === 'published' ? 'published' : 'draft'}>
            <option value="draft">Draft — not visible</option>
            <option value="published">Published — live on Giftify</option>
          </select>
        </div>
      </div>

      {type === 'monetary' ? (
        <div className="form-grid">
          <div className="field">
            <label htmlFor="min_amount">Minimum amount (QAR)</label>
            <input
              id="min_amount"
              name="min_amount"
              inputMode="decimal"
              defaultValue={product ? minorToInput(product.min_amount_minor) : '50.00'}
              placeholder="50.00"
            />
          </div>
          <div className="field">
            <label htmlFor="max_amount">Maximum amount (QAR)</label>
            <input
              id="max_amount"
              name="max_amount"
              inputMode="decimal"
              defaultValue={product ? minorToInput(product.max_amount_minor) : '500.00'}
              placeholder="500.00"
            />
          </div>
          <div className="field full">
            <label htmlFor="presets">Preset amounts (QAR)</label>
            <input
              id="presets"
              name="presets"
              defaultValue={
                product
                  ? (product.preset_amounts_minor ?? []).map((value) => minorToInput(value)).join(', ')
                  : '50, 100, 200, 500'
              }
              placeholder="50, 100, 200, 500"
            />
            <span className="hint">Comma-separated. Customers can still enter a custom amount.</span>
          </div>
        </div>
      ) : (
        <>
          {mode === 'create' ? (
            <div className="field">
              <label htmlFor="packages">Packages</label>
              <textarea
                id="packages"
                name="packages"
                required
                placeholder={'Massage for two | 1 | 250\nThree-visit reset | 3 | 600'}
                style={{ minHeight: 120 }}
              />
              <span className="hint">
                One package per line: <strong>Label | sessions | price in QAR</strong>. The customer
                chooses a package; they cannot choose the amount.
              </span>
            </div>
          ) : (
            <div className="callout info">
              Packages are managed below the form. Add, pause or remove packages there.
            </div>
          )}
        </>
      )}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="expiry_days">Expiry (days)</label>
          <input
            id="expiry_days"
            name="expiry_days"
            inputMode="numeric"
            defaultValue={product?.expiry_days ?? ''}
            placeholder="365"
          />
          <span className="hint">Leave blank for no expiry.</span>
        </div>
        <div className="field">
          <label htmlFor="valid_until">Valid until (optional)</label>
          <input
            id="valid_until"
            name="valid_until"
            type="date"
            defaultValue={product?.valid_until?.slice(0, 10) ?? ''}
          />
        </div>
        <div className="field">
          <label htmlFor="location">Location</label>
          <input
            id="location"
            name="location"
            defaultValue={product?.location ?? ''}
            placeholder="West Bay, Doha"
          />
        </div>
        <div className="field">
          <label htmlFor="occasions">Occasions</label>
          <input
            id="occasions"
            name="occasions"
            defaultValue={(product?.occasions ?? []).join(', ')}
            placeholder="Birthday, Thank you, Eid"
          />
        </div>
        <div className="field">
          <label htmlFor="tone">Card colour</label>
          <select id="tone" name="tone" defaultValue={normalizeTone(product?.tone)}>
            <option value="teal">Teal</option>
            <option value="pink">Pink</option>
            <option value="lavender">Lavender</option>
            <option value="gold">Gold</option>
            <option value="sky">Sky</option>
          </select>
          <span className="hint">The same five colours the app uses.</span>
        </div>
        <div className="field">
          <label htmlFor="image_url">Image URL (optional)</label>
          <input
            id="image_url"
            name="image_url"
            defaultValue={product?.image_url ?? ''}
            placeholder="https://…"
          />
        </div>
      </div>

      <div className="form-grid">
        <div className="field full">
          <label htmlFor="terms_and_conditions">Terms and conditions</label>
          <textarea
            id="terms_and_conditions"
            name="terms_and_conditions"
            defaultValue={product?.terms_and_conditions ?? ''}
            placeholder="Anything the customer should know before buying."
          />
        </div>
        <div className="field full">
          <label htmlFor="redemption_instructions">Redemption instructions</label>
          <textarea
            id="redemption_instructions"
            name="redemption_instructions"
            defaultValue={product?.redemption_instructions ?? ''}
            placeholder="What the customer should do when they visit."
          />
        </div>
      </div>

      <div className="pill-row">
        <label className="checkbox-row">
          <input
            type="checkbox"
            name="booking_required"
            defaultChecked={product?.booking_required ?? false}
          />
          Booking required
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            name="split_session_allowed"
            defaultChecked={product?.split_session_allowed ?? true}
          />
          Sessions can be split across visits
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            name="multi_session_per_visit"
            defaultChecked={product?.multi_session_per_visit ?? false}
          />
          More than one session per visit
        </label>
      </div>

      <div className="btn-row">
        <button className="btn primary" type="submit">
          {mode === 'create' ? 'Create gift' : 'Save changes'} <ArrowRight size={16} />
        </button>
        <span className="small muted">
          {mode === 'create'
            ? 'You can keep it as a draft and publish when it looks right.'
            : 'Changes go live immediately for published gifts.'}
        </span>
      </div>
    </form>
  );
}
