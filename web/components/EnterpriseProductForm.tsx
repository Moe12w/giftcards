'use client';

import { ArrowRight, Boxes } from 'lucide-react';
import type { EnterpriseProduct } from '@/lib/types';
import { minorToInput } from '@/lib/money';
import { useLocale } from '@/components/I18nProvider';
import { pick } from '@/lib/i18n';
import { componentsCopy } from '@/lib/i18n/components';

export function EnterpriseProductForm({
  action,
  product,
}: {
  action: (formData: FormData) => void | Promise<void>;
  product?: EnterpriseProduct | null;
}) {
  const locale = useLocale();
  const t = pick(componentsCopy, locale).enterpriseProductForm;

  return (
    <form action={action} className="card" style={{ display: 'grid', gap: 18 }}>
      {product ? <input type="hidden" name="product_id" value={product.id} /> : null}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="name">{t.name}</label>
          <input
            id="name"
            name="name"
            required
            defaultValue={product?.name ?? ''}
            placeholder={t.placeholders.name}
          />
        </div>
        <div className="field">
          <label htmlFor="external_ref">{t.externalRef}</label>
          <input
            id="external_ref"
            name="external_ref"
            defaultValue={product?.external_ref ?? ''}
            placeholder={t.placeholders.externalRef}
          />
        </div>
        <div className="field">
          <label htmlFor="denomination">{t.faceValue}</label>
          <input
            id="denomination"
            name="denomination"
            inputMode="decimal"
            required
            defaultValue={product ? minorToInput(product.denomination_minor) : '250.00'}
            placeholder="250.00"
          />
          <span className="hint">{t.hints.faceValue}</span>
        </div>
        <div className="field">
          <label htmlFor="selling_price">{t.sellingPrice}</label>
          <input
            id="selling_price"
            name="selling_price"
            inputMode="decimal"
            required
            defaultValue={product ? minorToInput(product.selling_price_minor) : '250.00'}
            placeholder="250.00"
          />
          <span className="hint">{t.hints.sellingPrice}</span>
        </div>
        <div className="field">
          <label htmlFor="commission_percent">{t.commission}</label>
          <input
            id="commission_percent"
            name="commission_percent"
            inputMode="decimal"
            defaultValue={product ? (product.commission_bps / 100).toString() : '10'}
            placeholder="10"
          />
          <span className="hint">{t.hints.commission}</span>
        </div>
        <div className="field">
          <label htmlFor="expiry_days">{t.expiryDays}</label>
          <input
            id="expiry_days"
            name="expiry_days"
            inputMode="numeric"
            defaultValue={product?.expiry_days ?? ''}
            placeholder="365"
          />
          <span className="hint">{t.hints.expiryDays}</span>
        </div>
        <div className="field">
          <label htmlFor="is_active">{t.availability}</label>
          <label className="checkbox-row">
            <input type="checkbox" name="is_active" defaultChecked={product?.is_active ?? true} />
            {t.activeAndAvailable}
          </label>
        </div>
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

      <div className="btn-row">
        <button className="btn lavender" type="submit">
          <Boxes size={16} /> {product ? t.saveProduct : t.createProduct} <ArrowRight size={16} />
        </button>
        <span className="small muted">{t.footerHint}</span>
      </div>
    </form>
  );
}
