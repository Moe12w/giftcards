'use client';

// Multi-select for the collections a gift appears in. The values are posted
// as repeated `occasions` fields, which is the column the app reads to decide
// which gifts show up on each collection page.
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { useLocale } from '@/components/I18nProvider';
import { PRODUCT_COLLECTIONS } from '@/lib/collections';
import { pick } from '@/lib/i18n';
import { componentsCopy } from '@/lib/i18n/components';

export function CollectionPicker({
  selected = [],
  labelId,
}: {
  selected?: string[];
  labelId?: string;
}) {
  const locale = useLocale();
  const t = pick(componentsCopy, locale).productForm.collections;

  const labels: Record<string, string> = {
    birthday: t.birthday,
    'for-her': t.forHer,
    'for-him': t.forHim,
    'thank-you': t.thankYou,
    'just-because': t.justBecause,
    anniversary: t.anniversary,
    congratulations: t.congratulations,
  };

  const [values, setValues] = useState<string[]>(() =>
    PRODUCT_COLLECTIONS.filter((slug) => selected.includes(slug)),
  );
  const [open, setOpen] = useState(false);

  function toggle(slug: string, checked: boolean) {
    setValues((current) =>
      checked ? [...current, slug] : current.filter((value) => value !== slug),
    );
  }

  return (
    <div className="collection-picker">
      <button
        type="button"
        className="collection-trigger"
        aria-labelledby={labelId}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={values.length > 0 ? undefined : 'muted'}>
          {values.length > 0
            ? values.map((slug) => labels[slug]).join(', ')
            : t.choose}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {/* Kept in the DOM while closed so the checkboxes still submit with the form. */}
      <div className="collection-options" role="group" aria-labelledby={labelId} hidden={!open}>
        {PRODUCT_COLLECTIONS.map((slug) => (
          <label className="checkbox-row" key={slug}>
            <input
              type="checkbox"
              name="occasions"
              value={slug}
              checked={values.includes(slug)}
              onChange={(event) => toggle(slug, event.target.checked)}
            />
            {labels[slug]}
          </label>
        ))}
      </div>
    </div>
  );
}
