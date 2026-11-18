// src/lib/auth.tsx
// Authentication context. Uses Supabase Auth when configured; otherwise runs a
// demo session so the customer app is testable in Expo Go before setup.
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as Linking from 'expo-linking';
import type { Session, User } from '@supabase/supabase-js';
import { handleAuthUrl, passwordResetLink } from './auth-link';
import { env, hasSupabaseConfig } from './env';
import { getSupabase } from './supabase';
import { registerPushToken } from './push';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isDemo: boolean;
  /** True only while a password-recovery flow is active (set by the auth event). */
  recovery: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /**
   * Creates an account. Returns the session when the project confirms emails
   * automatically, and null when the user still has to confirm by email.
   */
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ session: Session | null }>;
  signOut: () => Promise<void>;
  /** Sends a password recovery link to the given address. */
  resetPassword: (email: string) => Promise<void>;
  /** Sets a new password, used by the recovery screen. */
  updatePassword: (password: string) => Promise<void>;
  updateProfile: (patch: { full_name?: string; phone?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const DEMO_USER = {
  id: 'demo-user',
  email: 'demo@giftly.app',
  user_metadata: { full_name: 'Demo User' },
} as unknown as User;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(hasSupabaseConfig ? null : DEMO_USER);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    const supabase = getSupabase();

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setUser(next?.user ?? null);
      // The reset screen is only reachable through a recovery flow, so an
      // implicit-flow token link must not unlock the password change.
      setRecovery(event === 'PASSWORD_RECOVERY');
    });

    // A password recovery link opens the app directly. The session has to be
    // established before the reset screen can be used.
    Linking.getInitialURL().then((url) => {
      if (url) handleAuthUrl(url);
    });
    const linkSub = Linking.addEventListener('url', ({ url }) => {
      handleAuthUrl(url);
    });

    return () => {
      sub.subscription.unsubscribe();
      linkSub.remove();
    };
  }, []);

  // Register this device for push notifications whenever a real user signs in.
  // Best-effort: never blocks auth, and needs a dev build + EAS project id to
  // actually receive pushes in production.
  useEffect(() => {
    if (!user?.id || !hasSupabaseConfig) return;
    registerPushToken(user.id);
  }, [user?.id]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      session,
      loading,
      isDemo: !hasSupabaseConfig,
      recovery,
      async signIn(email, password) {
        if (!hasSupabaseConfig) return;
        const identifier = email.trim().toLowerCase();

        // Ask the auth gate whether this identifier is still inside the attempt
        // budget. The gate reads the same server-side ledger the web server
        // actions use; if it is unreachable we fail open rather than lock people
        // out of the app.
        let denied = false;
        if (env.authGateUrl) {
          try {
            const response = await fetch(env.authGateUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ identifier, outcome: 'check' }),
            });
            const data = (await response.json().catch(() => null)) as { allowed?: boolean } | null;
            denied = response.status === 429 || data?.allowed === false;
          } catch {
            // The gate is an optimisation; never block sign-in because of it.
          }
        }

        if (denied) {
          throw new Error('Too many sign-in attempts. Please wait a few minutes and try again.');
        }

        const { error } = await getSupabase().auth.signInWithPassword({ email, password });
        const success = !error;

        if (env.authGateUrl) {
          try {
            await fetch(env.authGateUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ identifier, outcome: 'record', success }),
            });
          } catch {
            // Best effort: never block the sign-in outcome on the ledger write.
          }
        }

        if (error) {
          // Never log credentials; user-agent details are enough for support.
          if (__DEV__) console.warn('[auth] sign in failed', error.message);
          throw error;
        }
      },
      async signUp(email, password, fullName) {
        if (!hasSupabaseConfig) return { session: null };
        const { data, error } = await getSupabase().auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) {
          if (__DEV__) console.warn('[auth] sign up failed', error.message);
          throw error;
        }
        return { session: data.session ?? null };
      },
      async signOut() {
        if (!hasSupabaseConfig) return;
        const { error } = await getSupabase().auth.signOut();
        if (error) {
          if (__DEV__) console.warn('[auth] sign out failed', error.message);
          throw error;
        }
      },
      async resetPassword(email) {
        if (!hasSupabaseConfig) return;
        const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
          redirectTo: passwordResetLink(),
        });
        if (error) {
          if (__DEV__) console.warn('[auth] reset failed', error.message);
          throw error;
        }
      },
      async updatePassword(password) {
        if (!hasSupabaseConfig) return;
        const { error } = await getSupabase().auth.updateUser({ password });
        if (error) {
          if (__DEV__) console.warn('[auth] update password failed', error.message);
          throw error;
        }
      },
      async updateProfile(patch) {
        if (!hasSupabaseConfig) {
          setUser((prev) =>
            prev
              ? ({
                  ...prev,
                  user_metadata: { ...prev.user_metadata, ...patch },
                } as User)
              : prev,
          );
          return;
        }
        const { error } = await getSupabase().auth.updateUser({ data: patch });
        if (error) throw error;
      },
    }),
    [user, session, loading, recovery],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
