// src/lib/env.ts
// Public environment values are safe to ship in the app bundle.
// SECRET keys (service role, MyFatoorah token, wallet certs) must NEVER be
// read here — they live only in Supabase Edge Functions.

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  appScheme: process.env.EXPO_PUBLIC_APP_SCHEME ?? 'giftly',
};

/** True when Supabase credentials have been provided. */
export const hasSupabaseConfig = Boolean(env.supabaseUrl && env.supabaseAnonKey);
