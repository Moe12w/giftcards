import React from 'react';
import { Stack } from 'expo-router';
import { useThemeRefresh } from '@/src/lib/theme';
import { colors } from '@/src/theme';

export default function OnboardingLayout() {
  useThemeRefresh();
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
