'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * Remembers that the walkthrough has been seen, so it only opens by itself for
 * brand new accounts. The tutorial button in the sidebar can always replay it.
 */
export async function completeTutorial() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('profiles')
    .update({ tutorial_completed_at: new Date().toISOString() })
    .eq('id', user.id);

  revalidatePath('/', 'layout');
}

/** Switches the dashboard between English and Arabic. */
export async function setDashboardLanguage(formData: FormData) {
  const locale = String(formData.get('locale') ?? 'en') === 'ar' ? 'ar' : 'en';
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('profiles')
    .update({ preferred_language: locale })
    .eq('id', user.id);

  revalidatePath('/', 'layout');
}
