// web/lib/i18n/server.ts
// Reading the current language on the server.
//
// The cookie is the single source of truth, because the public website has to
// work for visitors who are not signed in. When a visitor is signed in the
// choice is also written to their profile, so it follows them to the app.
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, pick, type Copy, type Locale } from './index';

/** The language this request should be rendered in. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return value === 'ar' ? 'ar' : 'en';
}

/**
 * The language for a signed-in page. The cookie wins, because it is what the
 * switch button changes; the profile is the fallback for a first visit.
 */
export async function getUserLocale(profileLanguage?: string | null): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  if (value === 'ar' || value === 'en') return value;
  return profileLanguage === 'ar' ? 'ar' : 'en';
}

/**
 * The half of a copy file that matches the current language.
 *
 * Server components call this once at the top of the page and then read the
 * words they need from the result.
 */
export async function getCopy<T>(copy: Copy<T>): Promise<T> {
  return pick(copy, await getLocale());
}
