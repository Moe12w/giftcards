// src/lib/env.ts
// Public environment values are safe to ship in the app bundle.
// SECRET keys (service role, MyFatoorah token, wallet certs) must NEVER be
// read here — they live only in Supabase Edge Functions.

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  appScheme: process.env.EXPO_PUBLIC_APP_SCHEME ?? 'tazella',
  /** The public web app, used to build claim links that open in a browser. */
  siteUrl: process.env.EXPO_PUBLIC_SITE_URL ?? '',
  /** Public endpoint of the login gate Edge Function used to rate-limit sign-ins. */
  authGateUrl: process.env.EXPO_PUBLIC_AUTH_GATE_URL ?? '',
};

/** True when Supabase credentials have been provided. */
export const hasSupabaseConfig = Boolean(env.supabaseUrl && env.supabaseAnonKey);

/**
 * Demo mode: the signed-in demo account and the bundled sample data. It exists
 * only to make a development build usable before a backend is configured, so
 * it is compiled out of release builds. A release build without Supabase
 * credentials stays signed out and shows empty states instead of pretending to
 * be a working account.
 */
export const demoMode = !hasSupabaseConfig && __DEV__;
