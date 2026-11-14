import React, { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Screen } from '@/src/components/Screen';
import { useThemeRefresh } from '@/src/lib/theme';
import { colors } from '@/src/theme';

/**
 * The amount step is now part of "Create your gift": money cards pick a preset
 * or custom amount there, and experience cards pick one of the vendor's
 * packages. Old links land on the compose screen instead of a second amount
 * picker.
 */
export default function GiftAmountScreen() {
  useThemeRefresh();
  const { id } = useLocalSearchParams<{ id: string }>();

  useEffect(() => {
    if (id) {
      router.replace(`/(customer)/gift/${id}/design`);
    } else {
      router.replace('/(customer)/(tabs)');
    }
  }, [id]);

  return (
    <Screen scroll={false}>
      <ActivityIndicator color={colors.teal} />
    </Screen>
  );
}
