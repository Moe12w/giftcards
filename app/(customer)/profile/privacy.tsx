import React, { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { FlowHeader } from '@/src/components/FlowHeader';
import { ListRow } from '@/src/components/ListRow';
import { Screen } from '@/src/components/Screen';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

export default function PrivacyScreen() {
  const { t } = useTranslation();
  const [profileVisible, setProfileVisible] = useState(true);
  const [analytics, setAnalytics] = useState(true);

  return (
    <Screen>
      <FlowHeader
        title={t('profile.privacy')}
        subtitle={t('profile.privacyBody')}
        onBack={() => router.back()}
      />

      <Card>
        <View style={styles.row}>
          <Text style={styles.label}>{t('profile.personalInfo')}</Text>
          <Switch
            value={profileVisible}
            onValueChange={setProfileVisible}
            trackColor={{ false: colors.borderSoft, true: colors.teal }}
            thumbColor={colors.surface}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t('notifications.preferences')}</Text>
          <Switch
            value={analytics}
            onValueChange={setAnalytics}
            trackColor={{ false: colors.borderSoft, true: colors.teal }}
            thumbColor={colors.surface}
          />
        </View>
      </Card>

      <Card>
        <ListRow
          icon="📄"
          tone="teal"
          title={t('info.privacy.title')}
          onPress={() => router.push('/(customer)/info/privacy')}
        />
        <ListRow
          icon="📜"
          tone="lavender"
          title={t('info.terms.title')}
          last
          onPress={() => router.push('/(customer)/info/terms')}
        />
      </Card>

      <Button
        label={t('profile.deleteAccount')}
        variant="danger"
        onPress={() => router.push('/(customer)/profile/delete')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: { flex: 1, fontFamily: fonts.semibold, fontSize: fontSizes.md, color: colors.text },
});
