// src/lib/auth-link.ts
// Supabase sends password recovery links to the app as deep links. On a phone
// the tokens arrive in the URL (fragment or `?code=`), so the session has to be
// established by hand before the reset screen can be used.
import * as Linking from 'expo-linking';

import { getSupabase } from './supabase';

/** Reads a parameter from either the query string or the fragment. */
function paramFrom(url: string, key: string): string | null {
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  for (const source of [query, hash]) {
    if (!source) continue;
    for (const part of source.split('&')) {
      const [name, ...rest] = part.split('=');
      if (name === key) return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

/**
 * Establishes a session from an incoming auth link.
 * Returns true when the link carried a usable session.
 */
export async function handleAuthUrl(url: string | null): Promise<boolean> {
  if (!url) return false;

  try {
    const supabase = getSupabase();

    // PKCE flow: the link carries ?code=...
    const code = paramFrom(url, 'code');
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      return !error;
    }

    // Implicit flow: the link carries #access_token=...&refresh_token=...
    const accessToken = paramFrom(url, 'access_token');
    const refreshToken = paramFrom(url, 'refresh_token');
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      return !error;
    }

    // Some links carry a plain error, for example when the token expired.
    const errorDescription = paramFrom(url, 'error_description');
    if (errorDescription) {
      console.warn('auth link error:', errorDescription);
    }
  } catch (error) {
    console.warn('Could not handle the auth link:', error);
  }
  return false;
}

/** The deep link the password reset email should send the user back to. */
export function passwordResetLink(): string {
  return Linking.createURL('/reset-password');
}
