// web/lib/actions/locale.ts
// Changes the language of the whole site.
//
// The choice is stored in a cookie, because the public website has to work
// for visitors who are not signed in. When there is a signed-in user the
// choice is also written to their profile, so it follows them to the app.
'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { LOCALE_COOKIE, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setLocale(formData: FormData) {
  const raw = String(formData.get('locale') ?? 'en');
  const locale: Locale = raw === 'ar' ? 'ar' : 'en';

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: ONE_YEAR,
    sameSite: 'lax',
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase
      .from('profiles')
      .update({ preferred_language: locale })
      .eq('id', user.id);
  }

  revalidatePath('/', 'layout');
}
