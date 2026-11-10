import React from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { useAuth } from '@/src/lib/auth';
import { setLanguage, type Language } from '@/src/i18n';
import { colors, fontSizes, radii, spacing } from '@/src/theme';

export default function AccountScreen() {
  const { t, i18n } = useTranslation();
  const { user, signOut, isDemo } = useAuth();
  const current = (i18n.language === 'ar' ? 'ar' : 'en') as Language;

  const name = (user?.user_metadata?.full_name as string | undefined) ?? '—';
  const email = user?.email ?? '—';

  async function changeLanguage(lang: Language) {
    await setLanguage(lang);
    // RTL changes may need a reload on native; warn the user in Arabic.
    if (Platform.OS !== 'web' && lang === 'ar') {
      Alert.alert(t('common.done'), t('account.rtlReloadHint'));
    }
  }

  function confirmSignOut() {
    Alert.alert(t('account.signOutConfirmTitle'), t('account.signOutConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('auth.signOut'),
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  function confirmDelete() {
    Alert.alert(t('account.deleteAccountTitle'), t('account.deleteAccountBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('account.deleteAccountConfirm'), style: 'destructive', onPress: () => undefined },
    ]);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>{t('account.title')}</Text>
        <Text style={styles.subtitle}>{t('account.subtitle')}</Text>
      </View>

      <Card style={styles.card}>
        <Text style={styles.sectionLabel}>{t('account.personalInfo')}</Text>
        <Row label={t('account.name')} value={name} />
        <Row label={t('account.email')} value={email} />
        {isDemo ? <Text style={styles.demoHint}>Demo mode — add Supabase keys to use real accounts.</Text> : null}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionLabel}>{t('account.language')}</Text>
        <View style={styles.langRow}>
          <LangButton
            label={t('account.english')}
            active={current === 'en'}
            onPress={() => changeLanguage('en')}
          />
          <LangButton
            label={t('account.arabic')}
            active={current === 'ar'}
            onPress={() => changeLanguage('ar')}
          />
        </View>
      </Card>

      <Button label={t('auth.signOut')} variant="secondary" onPress={confirmSignOut} />

      <Card style={[styles.card, styles.dangerCard]}>
        <Text style={styles.sectionLabel}>{t('account.dangerZone')}</Text>
        <Text style={styles.dangerBody}>{t('account.deleteAccountBody')}</Text>
        <Button label={t('account.deleteAccount')} variant="danger" onPress={confirmDelete} />
      </Card>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function LangButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.langButton, active && styles.langButtonActive]}
    >
      <Text style={[styles.langText, active && styles.langTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, marginTop: spacing.sm },
  title: { fontSize: fontSizes.display, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: fontSizes.md, color: colors.textMuted },
  card: { gap: spacing.sm },
  sectionLabel: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { fontSize: fontSizes.md, color: colors.textMuted },
  rowValue: { fontSize: fontSizes.md, color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  demoHint: { fontSize: fontSizes.xs, color: colors.warning, marginTop: spacing.xs },
  langRow: { flexDirection: 'row', gap: spacing.sm },
  langButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  langButtonActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  langText: { fontSize: fontSizes.md, color: colors.text },
  langTextActive: { color: colors.primaryDark, fontWeight: '700' },
  dangerCard: { borderColor: colors.danger },
  dangerBody: { fontSize: fontSizes.sm, color: colors.textMuted, lineHeight: 20 },
});
