import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Gift, PartyPopper } from 'lucide-react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Chip } from '@/src/components/Chip';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Glyph } from '@/src/components/Glyph';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { OCCASIONS } from '@/src/lib/catalog';
import { useThemeRefresh } from '@/src/lib/theme';
import { formatMoney } from '@/src/lib/money';
import type { OccasionId } from '@/src/lib/types';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '@/src/theme';

const GOALS = [0, 25000, 50000, 100000, 150000];

export default function CreateBasketScreen() {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  const [name, setName] = useState('');
  const [recipient, setRecipient] = useState('');
  const params = useLocalSearchParams<{ preset?: string }>();
  const [occasion, setOccasion] = useState<OccasionId>('birthday');
  const [goal, setGoal] = useState(50000);
  const [error, setError] = useState<string | null>(null);

  const lang = i18n.language === 'ar' ? 'ar' : 'en';
  const canContinue = name.trim().length > 0 && recipient.trim().length > 0;
  const selectedOccasion = useMemo(
    () => OCCASIONS.find((entry) => entry.slug === occasion),
    [occasion],
  );

  function next() {
    if (!canContinue) {
      setError(t('basket.requiredFields'));
      return;
    }
    setError(null);
    router.push(
      `/(customer)/basket/pick?name=${encodeURIComponent(name.trim())}&recipient=${encodeURIComponent(
        recipient.trim(),
      )}&occasion=${occasion}&target=${goal}${params.preset ? `&preset=${params.preset}` : ''}`,
    );
  }

  return (
    <Screen>
      <FlowHeader
        title={t('basket.createTitle')}
        subtitle={t('basket.createSubtitle')}
        step={0}
        total={3}
        onBack={() => router.back()}
      />

      <Card tone="lavender" style={styles.intro}>
        <View style={styles.introRow}>
          <View style={styles.introIcon}>
            <Gift size={24} color={colors.ink} />
          </View>
          <Text style={styles.introText}>{t('basket.createIntro')}</Text>
        </View>
      </Card>

      <Card style={styles.form}>
        <TextField
          label={t('basket.nameLabel')}
          value={name}
          onChangeText={(value) => {
            setName(value);
            setError(null);
          }}
          placeholder={t('basket.namePlaceholder')}
          error={error ?? undefined}
        />
        <TextField
          label={t('basket.recipientLabel')}
          value={recipient}
          onChangeText={(value) => {
            setRecipient(value);
            setError(null);
          }}
          placeholder={t('basket.recipientPlaceholder')}
        />

        <Text style={styles.sectionLabel}>{t('basket.occasionLabel')}</Text>
        <View style={styles.occasionWrap}>
          {OCCASIONS.map((entry) => {
            const active = entry.slug === occasion;
            return (
              <Pressable
                key={entry.slug}
                onPress={() => setOccasion(entry.slug as OccasionId)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t(entry.titleKey)}
                style={({ pressed }) => [
                  styles.occasionChip,
                  active && styles.occasionChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Glyph name={entry.icon} size={20} />
                <Text style={[styles.occasionText, active && styles.occasionTextActive]}>
                  {t(entry.titleKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card style={styles.form}>
        <Text style={styles.sectionLabel}>{t('basket.goalLabel')}</Text>
        <Text style={styles.sectionHint}>{t('basket.goalHint')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.goalRow}>
          {GOALS.map((value) => (
            <Chip
              key={value}
              label={value === 0 ? t('basket.noGoal') : formatMoney(value, lang)}
              active={goal === value}
              onPress={() => setGoal(value)}
            />
          ))}
        </ScrollView>
      </Card>

      {selectedOccasion ? (
        <Card tone="teal" style={styles.preview}>
          <View style={styles.previewRow}>
            <PartyPopper size={18} color={colors.ink} />
            <Text style={styles.previewText}>
              {t('basket.previewLine', {
                occasion: t(selectedOccasion.titleKey),
                recipient: recipient.trim() || t('basket.yourRecipient'),
              })}
            </Text>
          </View>
        </Card>
      ) : null}

      <Button label={t('common.continue')} onPress={next} disabled={!canContinue} />
    </Screen>
  );
}

const styles = themedStyles(() => ({
  intro: {},
  introRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  introIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text,
    lineHeight: 19,
  },
  form: { gap: spacing.sm },
  sectionLabel: {
    marginTop: spacing.xs,
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  sectionHint: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: -4,
  },
  occasionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  occasionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
  },
  occasionChipActive: { backgroundColor: colors.teal },
  occasionText: { fontFamily: fonts.semibold, fontSize: fontSizes.xs, color: colors.ink },
  occasionTextActive: { color: colors.textOnAccent },
  goalRow: { gap: spacing.sm, paddingRight: spacing.md },
  preview: {},
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  previewText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text,
    lineHeight: 18,
  },
  pressed: { opacity: 0.85 },
}));
