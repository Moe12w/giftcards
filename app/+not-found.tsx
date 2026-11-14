import { useThemeRefresh } from '@/src/lib/theme';
import React from 'react';
import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, fontSizes, spacing, themedStyles } from '@/src/theme';

export default function NotFoundScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('common.errorGeneric') }} />
      <View style={styles.container}>
        <Text style={styles.title}>{t('common.errorGeneric')}</Text>
        <Link href="/(customer)/(tabs)" style={styles.link}>
          <Text style={styles.linkText}>{t('common.continue')} →</Text>
        </Link>
      </View>
    </>
  );
}

const styles = themedStyles(() => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  title: { fontSize: fontSizes.xl, fontWeight: '700', color: colors.text },
  link: { marginTop: spacing.md, paddingVertical: spacing.sm },
  linkText: { fontSize: fontSizes.md, color: colors.primary, fontWeight: '600' },
}));
