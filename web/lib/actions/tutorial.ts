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
