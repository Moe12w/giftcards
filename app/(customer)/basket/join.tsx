import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Gift, Link2, Users } from 'lucide-react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { useBaskets } from '@/src/lib/baskets';
import { useThemeRefresh } from '@/src/lib/theme';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '@/src/theme';

/** Join a collaborative basket with an invite code or shared link. */
export default function JoinBasketScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { joinBasket, ready } = useBaskets();
  const [value, setValue] = useState(code ?? '');
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  async function submit() {
    const next = value.trim().toUpperCase();
    if (!/^GIFT-[A-Z0-9]{5}$/.test(next)) {
      setError(t('basket.joinInvalid'));
      return;
    }
    setError(null);
    setJoining(true);
    const joined = await joinBasket(next);
    setJoining(false);
    if (joined) {
      setValue('');
      router.replace(`/(customer)/basket/${joined.id}?invite=1`);
    } else {
      setError(t('basket.joinNotFound'));
    }
  }

  return (
    <Screen>
      <FlowHeader
        title={t('basket.joinTitle')}
        subtitle={t('basket.joinBody')}
        onBack={() => router.back()}
      />

      <Card tone="lavender" style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <Link2 size={24} color={colors.ink} />
          </View>
          <Text style={styles.heroText}>{t('basket.joinIntro')}</Text>
        </View>
      </Card>

      <Card style={styles.form}>
        <TextField
          label={t('basket.codeLabel')}
          value={value}
          onChangeText={(next) => {
            setValue(next.toUpperCase());
            setError(null);
          }}
          placeholder={t('basket.codePlaceholder')}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus={!code}
          error={error ?? undefined}
        />
        <Button
          label={t('basket.joinCta')}
          onPress={submit}
          loading={joining}
          disabled={!ready}
        />
      </Card>

      <Card tone="teal" style={styles.tip}>
        <Users size={18} color={colors.ink} />
        <Text style={styles.tipText}>{t('basket.joinTip')}</Text>
      </Card>

      <Card style={styles.createCard}>
        <View style={styles.createRow}>
          <View style={styles.createIcon}>
            <Gift size={20} color={colors.ink} />
          </View>
          <View style={styles.createCopy}>
            <Text style={styles.createTitle}>{t('basket.createTitle')}</Text>
            <Text style={styles.createBody}>{t('basket.createBody')}</Text>
          </View>
        </View>
        <Button
          label={t('basket.createCta')}
          variant="secondary"
          onPress={() => router.replace('/(customer)/basket/create')}
        />
      </Card>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  hero: {},
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text,
    lineHeight: 19,
  },
  form: { gap: spacing.sm },
  tip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tipText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text,
    lineHeight: 18,
  },
  createCard: { gap: spacing.sm },
  createRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  createIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.pinkTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createCopy: { flex: 1, gap: 1 },
  createTitle: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  createBody: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    lineHeight: 16,
  },
}));
