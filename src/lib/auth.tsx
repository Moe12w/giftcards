// src/lib/auth.tsx
// Authentication context. Uses Supabase Auth when configured; otherwise runs a
// demo session so the customer app is testable in Expo Go before setup.
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as Linking from 'expo-linking';
import type { Session, User } from '@supabase/supabase-js';
import { handleAuthUrl, passwordResetLink } from './auth-link';
import { hasSupabaseConfig } from './env';
import { getSupabase } from './supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isDemo: boolean;
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

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    const supabase = getSupabase();

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setUser(next?.user ?? null);
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

  const value = useMemo<AuthState>(
    () => ({
      user,
      session,
      loading,
      isDemo: !hasSupabaseConfig,
      async signIn(email, password) {
        if (!hasSupabaseConfig) return;
        const { error } = await getSupabase().auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      async signUp(email, password, fullName) {
        if (!hasSupabaseConfig) return { session: null };
        const { data, error } = await getSupabase().auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        return { session: data.session ?? null };
      },
      async signOut() {
        if (!hasSupabaseConfig) return;
        const { error } = await getSupabase().auth.signOut();
        if (error) throw error;
      },
      async resetPassword(email) {
        if (!hasSupabaseConfig) return;
        const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
          redirectTo: passwordResetLink(),
        });
        if (error) throw error;
      },
      async updatePassword(password) {
        if (!hasSupabaseConfig) return;
        const { error } = await getSupabase().auth.updateUser({ password });
        if (error) throw error;
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
    [user, session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
