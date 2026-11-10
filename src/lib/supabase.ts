// src/lib/supabase.ts
// Supabase client for the mobile/web app. Uses only the public anon key.
// Secret operations (payments, webhooks, wallet passes) run in Edge Functions.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, hasSupabaseConfig } from './env';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!hasSupabaseConfig) {
    throw new Error(
      'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env file.',
    );
  }
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // The web build reads the recovery link straight from the URL. On a
        // phone the same link arrives through Linking and is handled by
        // `src/lib/auth-link.ts`.
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
  }
  return client;
}

export { hasSupabaseConfig };
