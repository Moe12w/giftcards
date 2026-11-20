// web/components/LanguageSwitch.tsx
// The button that switches the whole site between English and Arabic.
//
// It calls a server action that writes the cookie (and the signed-in user's
// profile). The caller then refreshes or navigates so the new locale is shown.
'use client';

import { Languages } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setLocale } from '@/lib/actions/locale';
import { useLocale } from '@/components/I18nProvider';
import { common } from '@/lib/i18n/common';
import { pick } from '@/lib/i18n';

/**
 * The compact switch used in the dashboard menu: two small buttons, the
 * active one highlighted. The dashboard stays on the same URL; refreshing
 * re-renders it in the new language from the cookie.
 */
export function LanguageSwitch() {
  const locale = useLocale();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const copy = pick(common, locale);

  function choose(next: 'en' | 'ar') {
    const data = new FormData();
    data.set('locale', next);
    startTransition(async () => {
      await setLocale(data);
      router.refresh();
    });
  }

  return (
    <div className="lang-switch">
      <span className="small muted">{copy.language.label}</span>
      <button
        type="button"
        onClick={() => choose('en')}
        className={locale === 'en' ? 'active' : ''}
        aria-pressed={locale === 'en'}
        title={copy.language.english}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => choose('ar')}
        className={locale === 'ar' ? 'active' : ''}
        aria-pressed={locale === 'ar'}
        title={copy.language.arabic}
      >
        ع
      </button>
    </div>
  );
}

/**
 * The single-button version used in the public site header. Public pages are
 * prerendered per locale, so after setting the cookie we navigate to the same
 * path under the new `/en` or `/ar` prefix.
 */
export function LanguageButton() {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const copy = pick(common, locale);
  const next = locale === 'ar' ? 'en' : 'ar';
  const label = next === 'ar' ? copy.language.switchToArabic : copy.language.switchToEnglish;

  function switchLanguage() {
    const data = new FormData();
    data.set('locale', next);
    startTransition(async () => {
      await setLocale(data);
      // Neutral URLs (from the rewrites) and /en/... or /ar/... both work.
      const path = window.location.pathname.replace(/^\/(en|ar)(?=\/|$)/, '');
      const rest = path === '/' ? '' : path;
      router.push(`/${next}${rest}`);
    });
  }

  return (
    <button
      type="button"
      onClick={switchLanguage}
      className="lang-button"
      aria-label={label}
      title={label}
      disabled={pending}
    >
      <Languages size={15} />
      {next === 'ar' ? 'ع' : 'EN'}
    </button>
  );
}
