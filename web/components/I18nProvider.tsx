// web/components/I18nProvider.tsx
// Shares the current language with the interactive parts of the site.
//
// Server components read the locale directly. Client components cannot, so
// they take it from here instead of having it threaded through every prop.
'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Locale } from '@/lib/i18n';

const LocaleContext = createContext<Locale>('en');

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** The language the page is being rendered in. */
export function useLocale(): Locale {
  return useContext(LocaleContext);
}
