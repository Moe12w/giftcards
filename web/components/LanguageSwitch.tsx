// web/components/LanguageSwitch.tsx
// The button that switches the whole site between English and Arabic.
//
// It posts to a server action that writes the cookie, so the choice survives
// a reload and works for visitors who are not signed in.
'use client';

import { Languages } from 'lucide-react';
import { setLocale } from '@/lib/actions/locale';
import { useLocale } from '@/components/I18nProvider';
import { common } from '@/lib/i18n/common';
import { pick } from '@/lib/i18n';

/**
 * The compact switch used in the dashboard menu: two small buttons, the
 * active one highlighted.
 */
export function LanguageSwitch() {
  const locale = useLocale();
  const copy = pick(common, locale);

  return (
    <form action={setLocale} className="lang-switch">
      <span className="small muted">{copy.language.label}</span>
      <button
        type="submit"
        name="locale"
        value="en"
        className={locale === 'en' ? 'active' : ''}
        aria-pressed={locale === 'en'}
        title={copy.language.english}
      >
        EN
      </button>
      <button
        type="submit"
        name="locale"
        value="ar"
        className={locale === 'ar' ? 'active' : ''}
        aria-pressed={locale === 'ar'}
        title={copy.language.arabic}
      >
        ع
      </button>
    </form>
  );
}

/**
 * The single-button version used in the public site header: it shows the
 * language you would switch to.
 */
export function LanguageButton() {
  const locale = useLocale();
  const copy = pick(common, locale);
  const next = locale === 'ar' ? 'en' : 'ar';
  const label = next === 'ar' ? copy.language.switchToArabic : copy.language.switchToEnglish;

  return (
    <form action={setLocale} className="lang-button-form">
      <input type="hidden" name="locale" value={next} />
      <button type="submit" className="lang-button" aria-label={label} title={label}>
        <Languages size={15} />
        {next === 'ar' ? 'ع' : 'EN'}
      </button>
    </form>
  );
}
