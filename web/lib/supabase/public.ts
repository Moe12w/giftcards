import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Anonymous, request-independent Supabase client for cached public reads.
 * Cookie-aware clients cannot be used inside a cross-request cache scope, and
 * public catalogue rows are readable by `anon` under RLS.
 */
export function getPublicClient(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return client;
}
