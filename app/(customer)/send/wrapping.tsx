import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { useGiftDraft } from '@/src/lib/gift-draft';
import { colors, fonts, fontSizes, radii, spacing } from '@/src/theme';

const THEMES = ['confetti', 'floral', 'stars', 'minimal'] as const;
const WRAPPINGS = ['ribbon', 'box', 'envelope', 'none'] as const;

export default function WrappingScreen() {
  const { t } = useTranslation();
  const { draft, update } = useGiftDraft();

  return (
    <Screen>
      <FlowHeader
        title={t('send.wrappingTitle')}
        subtitle={t('send.wrappingSubtitle')}
        step={3}
        total={4}
        onBack={() => router.back()}
      />

      <Text style={styles.label}>{t('send.theme')}</Text>
      <View style={styles.grid}>
        {THEMES.map((theme) => {
          const active = draft.theme === theme;
          return (
            <Pressable
              key={theme}
              onPress={() => update({ theme })}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              <Card tone={active ? 'lavender' : 'surface'} style={styles.themeCard}>
                <Text style={styles.themeEmoji}>
                  {theme === 'confetti'
                    ? '🎊'
                    : theme === 'floral'
                      ? '🌸'
                      : theme === 'stars'
                        ? '✨'
                        : '◻️'}
                </Text>
                <Text style={styles.themeLabel}>{t(`send.themes.${theme}`)}</Text>
              </Card>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>{t('send.wrapping')}</Text>
      <View style={styles.wraps}>
        {WRAPPINGS.map((wrapping) => {
          const active = draft.wrapping === wrapping;
          return (
            <Pressable
              key={wrapping}
              onPress={() => update({ wrapping })}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [
                styles.wrap,
                active && styles.wrapActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.wrapLabel, active && styles.wrapLabelActive]}>
                {t(`send.wrappings.${wrapping}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Button
        label={t('common.continue')}
        onPress={() => router.push('/(customer)/send/preview')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
  item: { width: '48%' },
  themeCard: { alignItems: 'center', gap: 4, paddingVertical: spacing.md },
  themeEmoji: { fontSize: 30 },
  themeLabel: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.text,
  },
  wraps: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  wrap: {
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  wrapActive: { backgroundColor: colors.teal },
  wrapLabel: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.text,
  },
  wrapLabelActive: { color: colors.textOnAccent },
  pressed: { opacity: 0.88 },
});
