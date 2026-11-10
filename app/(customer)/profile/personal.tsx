import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { FlowHeader } from '@/src/components/FlowHeader';
import { ListRow } from '@/src/components/ListRow';
import { Screen } from '@/src/components/Screen';
import { useAuth } from '@/src/lib/auth';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

export default function PersonalInfoScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <Screen>
      <FlowHeader title={t('profile.personalInfo')} onBack={() => router.back()} />

      <Card>
        <ListRow
          icon="user"
          tone="teal"
          title={t('auth.fullName')}
          value={(user?.user_metadata?.full_name as string | undefined) ?? '—'}
        />
        <ListRow
          icon="mail"
          tone="pink"
          title={t('auth.email')}
          value={user?.email ?? '—'}
        />
        <ListRow
          icon="mail"
          tone="lavender"
          title={t('auth.phone')}
          value={(user?.user_metadata?.phone as string | undefined) ?? '—'}
          last
        />
      </Card>

      <Card tone="teal">
        <Text style={styles.body}>{t('profile.privacyBody')}</Text>
      </Card>

      <Button
        label={t('profile.editProfile')}
        onPress={() => router.push('/(customer)/profile/edit')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text,
    lineHeight: 20,
  },
});
