// src/lib/env.ts
// Public environment values are safe to ship in the app bundle.
// SECRET keys (service role, MyFatoorah token, wallet certs) must NEVER be
// read here — they live only in Supabase Edge Functions.

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  appScheme: process.env.EXPO_PUBLIC_APP_SCHEME ?? 'giftly',
  /** The public web app, used to build claim links that open in a browser. */
  siteUrl: process.env.EXPO_PUBLIC_SITE_URL ?? '',
  /** Public endpoint of the login gate Edge Function used to rate-limit sign-ins. */
  authGateUrl: process.env.EXPO_PUBLIC_AUTH_GATE_URL ?? '',
};

/** True when Supabase credentials have been provided. */
export const hasSupabaseConfig = Boolean(env.supabaseUrl && env.supabaseAnonKey);
