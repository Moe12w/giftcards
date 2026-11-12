// web/lib/i18n/index.ts
// The shape every translation file follows.
//
// A copy file holds the English text and the Arabic text side by side. The
// Arabic object is typed against the English one, so a missing or misspelled
// translation is a compile error rather than a page that half-switches.

export type Locale = 'en' | 'ar';

export const LOCALES: Locale[] = ['en', 'ar'];

export const LOCALE_COOKIE = 'giftly.locale';

export interface Copy<T> {
  en: T;
  ar: T;
}

/** Chooses the half of a copy object that matches the current locale. */
export function pick<T>(copy: Copy<T>, locale: Locale): T {
  return locale === 'ar' ? copy.ar : copy.en;
}

/** Fills `{name}` style placeholders. */
export function fill(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

/** Arabic reads right to left, English left to right. */
export function dirFor(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
