import React from 'react';
import { Stack } from 'expo-router';
import { useThemeRefresh } from '@/src/lib/theme';
import { colors } from '@/src/theme';
import { SignupDraftProvider } from '@/src/lib/signup-draft';

export default function AuthLayout() {
  useThemeRefresh();
  return (
    <SignupDraftProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </SignupDraftProvider>
  );
}
