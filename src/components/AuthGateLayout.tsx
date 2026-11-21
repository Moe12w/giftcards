// src/components/AuthGateLayout.tsx
// Nested layout for account-only route groups. Guests can still browse the
// marketplace; deep links into these routes get a sign-in prompt instead of a
// hard redirect, and resume the requested route after authenticating.
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useSegments } from 'expo-router';

import { useAuth } from '@/src/lib/auth';
import { colors, themedStyles } from '@/src/theme';
import { GuestGate } from './GuestGate';

interface AuthGateLayoutProps {
  /** Last route segment(s) that stay available without an account. */
  publicSegments?: string[];
}

export function AuthGateLayout({ publicSegments = [] }: AuthGateLayoutProps) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const last = segments[segments.length - 1] ?? '';

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  if (!user && !publicSegments.includes(last)) {
    return <GuestGate showBrowse />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    />
  );
}

const styles = themedStyles(() => ({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
}));
