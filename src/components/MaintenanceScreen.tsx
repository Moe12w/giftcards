// src/components/MaintenanceScreen.tsx
import React from 'react';
import { Text, View } from 'react-native';
import { Wrench } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/src/components/Screen';
import type { MaintenanceSetting } from '@/src/lib/app-config';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';

/** Shown instead of the customer app while an admin has maintenance enabled. */
export function MaintenanceScreen({ setting }: { setting: MaintenanceSetting }) {
  const { i18n } = useTranslation();
  const arabic = i18n.language === 'ar';
  const message = arabic ? setting.messageAr || setting.message : setting.message;

  return (
    <Screen>
      <View style={styles.wrap}>
        <View style={styles.icon}>
          <Wrench size={38} color={colors.ink} />
        </View>
        <Text style={styles.title}>
          {arabic ? 'نعود قريبًا' : 'We’ll be back soon'}
        </Text>
        <Text style={styles.body}>
          {message ||
            (arabic
              ? 'نعمل على تحسين التطبيق. يرجى المحاولة بعد قليل.'
              : 'We’re making a few improvements. Please try again shortly.')}
        </Text>
      </View>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  icon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealTint,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xxl,
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
}));
