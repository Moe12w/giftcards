import React, { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { useAuth } from '@/src/lib/auth';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';
import { Glyph } from '@/src/components/Glyph';

export default function DeleteAccountScreen() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const [confirming, setConfirming] = useState(false);

  function requestDelete() {
    setConfirming(true);
    Alert.alert(t('profile.deleteTitle'), t('profile.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel', onPress: () => setConfirming(false) },
      {
        text: t('profile.deleteConfirm'),
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  return (
    <Screen>
      <FlowHeader title={t('profile.deleteAccount')} onBack={() => router.back()} />

      <Card tone="pink">
        <Glyph name="warning" size={26} />
        <Text style={styles.body}>{t('profile.deleteBody')}</Text>
      </Card>

      <Button
        label={t('profile.deleteConfirm')}
        variant="danger"
        loading={confirming}
        onPress={requestDelete}
      />
      <Button label={t('common.cancel')} variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: spacing.sm,
  },
});
