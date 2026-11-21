import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';

import { MaintenanceScreen } from '@/src/components/MaintenanceScreen';
import { useAppConfig } from '@/src/lib/app-config';
import { useAuth } from '@/src/lib/auth';
import { BasketProvider } from '@/src/lib/baskets';
import { GiftDraftProvider } from '@/src/lib/gift-draft';
import { useThemeRefresh } from '@/src/lib/theme';
import { colors } from '@/src/theme';

export default function CustomerLayout() {
  useThemeRefresh();
  const { user, loading } = useAuth();
  const { config } = useAppConfig();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }
  // Guests browse the marketplace freely; account-only routes are gated by
  // their own nested layouts and the profile/wallet tabs.
  if (config.controls.maintenance.enabled) {
    return <MaintenanceScreen setting={config.controls.maintenance} />;
  }

  return (
    <BasketProvider key={user?.id ?? 'anon'}>
      <GiftDraftProvider key={user?.id ?? 'anon'}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" />
        </Stack>
      </GiftDraftProvider>
    </BasketProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
