'use client';

import { useState } from 'react';
import { ArrowRight, CalendarHeart, Gift } from 'lucide-react';
import type { Product } from '@/lib/types';
import { minorToInput } from '@/lib/money';
import { normalizeTone } from '@/lib/catalog';
import { useLocale } from '@/components/I18nProvider';
import { pick } from '@/lib/i18n';
import { componentsCopy } from '@/lib/i18n/components';

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
  const locale = useLocale();
  const t = pick(componentsCopy, locale).productForm;

  return (
    <form action={action} className="card" style={{ display: 'grid', gap: 18 }}>
      {product ? <input type="hidden" name="product_id" value={product.id} /> : null}

      <div className="form-grid">
        <div className="field full">
          <label htmlFor="title">{t.title}</label>
          <input
            id="title"
            name="title"
            required
            defaultValue={product?.title ?? ''}
            placeholder={t.placeholders.title}
          />
        </div>
        <div className="field">
          <label htmlFor="title_ar">{t.titleAr}</label>
          <input id="title_ar" name="title_ar" defaultValue={product?.title_ar ?? ''} dir="rtl" />
        </div>
        <div className="field">
          <label htmlFor="category_id">{t.category}</label>
          <select id="category_id" name="category_id" defaultValue={product?.category_id ?? ''}>
            <option value="">{t.noCategory}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field full">
          <label htmlFor="description">{t.description}</label>
          <textarea
            id="description"
            name="description"
            defaultValue={product?.description ?? ''}
            placeholder={t.placeholders.description}
          />
        </div>

        <div className="field">
          <label htmlFor="fulfilment_type">{t.fulfilment}</label>
          {mode === 'create' ? (
            <select
              id="fulfilment_type"
              name="fulfilment_type"
              value={type}
              onChange={(event) => setType(event.target.value as 'monetary' | 'experience')}
            >
              <option value="monetary">{t.fulfilmentMoney}</option>
              <option value="experience">{t.fulfilmentExperience}</option>
            </select>
          ) : (
            <>
              <input type="hidden" name="fulfilment_type" value={type} />
              <div className="callout info" style={{ boxShadow: 'none' }}>
                {type === 'experience' ? (
                  <>
                    <CalendarHeart size={15} style={{ display: 'inline', verticalAlign: '-2px' }} />{' '}
                    {t.experienceNote}
                  </>
                ) : (
                  <>
                    <Gift size={15} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t.moneyNote}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className="field">
          <label htmlFor="status">{t.status}</label>
          <select id="status" name="status" defaultValue={product?.status === 'published' ? 'published' : 'draft'}>
            <option value="draft">{t.statusDraft}</option>
            <option value="published">{t.statusPublished}</option>
          </select>
        </div>
      </div>

      {type === 'monetary' ? (
        <div className="form-grid">
          <div className="field">
            <label htmlFor="min_amount">{t.minAmount}</label>
            <input
              id="min_amount"
              name="min_amount"
              inputMode="decimal"
              defaultValue={product ? minorToInput(product.min_amount_minor) : '50.00'}
              placeholder="50.00"
            />
          </div>
          <div className="field">
            <label htmlFor="max_amount">{t.maxAmount}</label>
            <input
              id="max_amount"
              name="max_amount"
              inputMode="decimal"
              defaultValue={product ? minorToInput(product.max_amount_minor) : '500.00'}
              placeholder="500.00"
            />
          </div>
          <div className="field full">
            <label htmlFor="presets">{t.presetAmounts}</label>
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
            <span className="hint">{t.presetsHint}</span>
          </div>
        </div>
      ) : (
        <>
          {mode === 'create' ? (
            <div className="field">
              <label htmlFor="packages">{t.packages}</label>
              <textarea
                id="packages"
                name="packages"
                required
                placeholder={'Massage for two | 1 | 250\nThree-visit reset | 3 | 600'}
                style={{ minHeight: 120 }}
              />
              <span className="hint">{t.packagesHint}</span>
            </div>
          ) : (
            <div className="callout info">{t.packagesManagedBelow}</div>
          )}
        </>
      )}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="expiry_days">{t.expiryDays}</label>
          <input
            id="expiry_days"
            name="expiry_days"
            inputMode="numeric"
            defaultValue={product?.expiry_days ?? ''}
            placeholder="365"
          />
          <span className="hint">{t.expiryHint}</span>
        </div>
        <div className="field">
          <label htmlFor="valid_until">{t.validUntil}</label>
          <input
            id="valid_until"
            name="valid_until"
            type="date"
            defaultValue={product?.valid_until?.slice(0, 10) ?? ''}
          />
        </div>
        <div className="field">
          <label htmlFor="location">{t.location}</label>
          <input
            id="location"
            name="location"
            defaultValue={product?.location ?? ''}
            placeholder={t.placeholders.location}
          />
        </div>
        <div className="field">
          <label htmlFor="occasions">{t.occasions}</label>
          <input
            id="occasions"
            name="occasions"
            defaultValue={(product?.occasions ?? []).join(', ')}
            placeholder={t.placeholders.occasions}
          />
        </div>
        <div className="field">
          <label htmlFor="tone">{t.tone}</label>
          <select id="tone" name="tone" defaultValue={normalizeTone(product?.tone)}>
            <option value="teal">{t.tones.teal}</option>
            <option value="pink">{t.tones.pink}</option>
            <option value="lavender">{t.tones.lavender}</option>
            <option value="gold">{t.tones.gold}</option>
            <option value="sky">{t.tones.sky}</option>
          </select>
          <span className="hint">{t.toneHint}</span>
        </div>
        <div className="field">
          <label htmlFor="image_url">{t.imageUrl}</label>
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
          <label htmlFor="terms_and_conditions">{t.terms}</label>
          <textarea
            id="terms_and_conditions"
            name="terms_and_conditions"
            defaultValue={product?.terms_and_conditions ?? ''}
            placeholder={t.placeholders.terms}
          />
        </div>
        <div className="field full">
          <label htmlFor="redemption_instructions">{t.redemption}</label>
          <textarea
            id="redemption_instructions"
            name="redemption_instructions"
            defaultValue={product?.redemption_instructions ?? ''}
            placeholder={t.placeholders.redemption}
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
          {t.bookingRequired}
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            name="split_session_allowed"
            defaultChecked={product?.split_session_allowed ?? true}
          />
          {t.sessionsSplit}
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            name="multi_session_per_visit"
            defaultChecked={product?.multi_session_per_visit ?? false}
          />
          {t.moreThanOneSession}
        </label>
      </div>

      <div className="btn-row">
        <button className="btn primary" type="submit">
          {mode === 'create' ? t.createGift : t.saveChanges} <ArrowRight size={16} />
        </button>
        <span className="small muted">
          {mode === 'create' ? t.draftHint : t.changesHint}
        </span>
      </div>
    </form>
  );
}
