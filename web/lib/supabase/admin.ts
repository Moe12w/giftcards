import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Server-only Supabase client that bypasses RLS.
 *
 * Used by route handlers that authenticate with a partner's API key instead of
 * a signed-in user, such as the enterprise code webhook. Never import this from
 * a client component or a page that renders in the browser.
 */
export function createAdminClient() {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
