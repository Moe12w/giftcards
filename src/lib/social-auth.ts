// src/lib/social-auth.ts
// Apple and Google sign-in.
//
// Apple uses the native sheet and the ID token it returns. Google goes through
// Supabase's hosted OAuth flow inside an in-app browser session, so no native
// Google module (and none of its Play signing-key configuration) is needed.
//
// Both paths end in a Supabase session; the auth context picks it up through
// `onAuthStateChange`, exactly like a password sign-in.
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { demoMode } from './env';
import { getSupabase } from './supabase';

/** Why a social sign-in did not produce a session. */
export type SocialAuthFailure = 'cancelled' | 'unavailable' | 'failed';

export class SocialAuthError extends Error {
  readonly reason: SocialAuthFailure;

  constructor(reason: SocialAuthFailure) {
    super(reason);
    this.name = 'SocialAuthError';
    this.reason = reason;
  }
}

/** Path the OAuth provider sends the user back to. Must be allow-listed in Supabase. */
const CALLBACK_PATH = 'auth-callback';

/** The deep link the browser-based providers return to (`tazella://auth-callback`). */
export function oauthRedirectUrl(): string {
  return Linking.createURL(CALLBACK_PATH);
}

function normalizePath(value: string): string {
  return value.replace(/\/+$/, '') || '/';
}

/** Reads a parameter from either the query string or the fragment. */
function paramFrom(url: string, key: string): string | null {
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  for (const source of [query, hash]) {
    if (!source) continue;
    for (const part of source.split('&')) {
      const [name, ...rest] = part.split('=');
      if (name === key) return decodeURIComponent(rest.join('=').replace(/\+/g, ' '));
    }
  }
  return null;
}

/** True when the device can show the native Apple sheet (iOS 13+). */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Apple only returns the user's name on the very first authorization, so it is
 * saved immediately. The profile row is created by a database trigger before
 * the name exists, which leaves `full_name` null until this patch.
 */
async function saveAppleName(userId: string, fullName: string): Promise<void> {
  try {
    const supabase = getSupabase();
    await supabase.auth.updateUser({ data: { full_name: fullName } });
    await supabase.from('profiles').update({ full_name: fullName }).eq('id', userId);
  } catch (error) {
    // A missing display name must never cost the user their session.
    if (__DEV__) console.warn('[auth] could not save the Apple display name', error);
  }
}

/** Signs in with the native Apple sheet. iOS only. */
export async function signInWithApple(): Promise<void> {
  if (demoMode) return;
  if (!(await isAppleSignInAvailable())) {
    throw new SocialAuthError('unavailable');
  }

  // Supabase compares the SHA-256 hash of the nonce it receives against the
  // nonce claim Apple signed into the token, so Apple must be given the hash
  // and Supabase the raw value.
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === 'ERR_REQUEST_CANCELED') throw new SocialAuthError('cancelled');
    if (__DEV__) console.warn('[auth] Apple sign-in failed', error);
    throw new SocialAuthError('failed');
  }

  const identityToken = credential.identityToken;
  if (!identityToken) {
    throw new SocialAuthError('failed');
  }

  const { data, error } = await getSupabase().auth.signInWithIdToken({
    provider: 'apple',
    token: identityToken,
    nonce: rawNonce,
  });
  if (error) {
    if (__DEV__) console.warn('[auth] Apple token exchange failed', error.message);
    throw new SocialAuthError('failed');
  }

  const fullName = [
    credential.fullName?.givenName,
    credential.fullName?.middleName,
    credential.fullName?.familyName,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (fullName && data.user) await saveAppleName(data.user.id, fullName);
}

/** Turns the URL the browser session returned with into a Supabase session. */
async function completeOAuthRedirect(url: string): Promise<void> {
  let incoming: URL;
  try {
    incoming = new URL(url);
  } catch {
    throw new SocialAuthError('failed');
  }

  // Only our own callback may install a session. Without this check a crafted
  // deep link could sign the user into an account somebody else controls.
  const expected = new URL(oauthRedirectUrl());
  const isOurCallback =
    incoming.protocol === expected.protocol &&
    ((incoming.host === expected.host &&
      normalizePath(incoming.pathname) === normalizePath(expected.pathname)) ||
      // Expo may encode the path as the host (`tazella://auth-callback`).
      (normalizePath(incoming.pathname) === `/${CALLBACK_PATH}` &&
        (incoming.host === '' || incoming.host === expected.host)));
  if (!isOurCallback) {
    throw new SocialAuthError('failed');
  }

  const providerError = paramFrom(url, 'error_description') ?? paramFrom(url, 'error');
  if (providerError) {
    if (__DEV__) console.warn('[auth] OAuth provider error', providerError);
    throw new SocialAuthError('failed');
  }

  const code = paramFrom(url, 'code');
  if (!code) throw new SocialAuthError('failed');

  // The client uses the PKCE flow, so the verifier it stored before opening the
  // browser is what makes this exchange valid.
  const { error } = await getSupabase().auth.exchangeCodeForSession(code);
  if (error) {
    if (__DEV__) console.warn('[auth] code exchange failed', error.message);
    throw new SocialAuthError('failed');
  }
}

/** Signs in with Google through Supabase's OAuth flow. */
export async function signInWithGoogle(): Promise<void> {
  if (demoMode) return;

  const supabase = getSupabase();
  const redirectTo = oauthRedirectUrl();

  if (Platform.OS === 'web') {
    // On the web the page itself is redirected; the client picks the session up
    // from the callback URL.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) {
      if (__DEV__) console.warn('[auth] Google OAuth start failed', error.message);
      throw new SocialAuthError('failed');
    }
    return;
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) {
    if (__DEV__) console.warn('[auth] Google OAuth start failed', error?.message);
    throw new SocialAuthError('failed');
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new SocialAuthError('cancelled');
  }
  if (result.type !== 'success') throw new SocialAuthError('failed');

  await completeOAuthRedirect(result.url);
}
