import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/src/lib/auth';
import { hasSupabaseConfig } from '@/src/lib/env';
import { BasketProvider } from '@/src/lib/baskets';
import { GiftDraftProvider } from '@/src/lib/gift-draft';
import { useThemeRefresh } from '@/src/lib/theme';
import { colors } from '@/src/theme';

export default function CustomerLayout() {
  useThemeRefresh();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }
  if (hasSupabaseConfig && !user) {
    return <Redirect href="/(auth)/login" />;
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
