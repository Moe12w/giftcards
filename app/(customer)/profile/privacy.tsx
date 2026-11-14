import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { FlowHeader } from '@/src/components/FlowHeader';
import { ListRow } from '@/src/components/ListRow';
import { Screen } from '@/src/components/Screen';
import { getPreferences, savePreferences } from '@/src/lib/data';
import { useThemeRefresh } from '@/src/lib/theme';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';

export default function PrivacyScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const [profileVisible, setProfileVisible] = useState(true);
  const [analytics, setAnalytics] = useState(true);

  useEffect(() => {
    getPreferences()
      .then((rows) => {
        setAnalytics(rows.privacy_analytics);
        setProfileVisible(rows.privacy_personalised);
      })
      .catch(() => undefined);
  }, []);

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
            onValueChange={(value) => {
              setProfileVisible(value);
              savePreferences({ privacy_personalised: value }).catch(() => undefined);
            }}
            trackColor={{ false: colors.borderSoft, true: colors.teal }}
            thumbColor={colors.surface}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t('notifications.preferences')}</Text>
          <Switch
            value={analytics}
            onValueChange={(value) => {
              setAnalytics(value);
              savePreferences({ privacy_analytics: value }).catch(() => undefined);
            }}
            trackColor={{ false: colors.borderSoft, true: colors.teal }}
            thumbColor={colors.surface}
          />
        </View>
      </Card>

      <Card>
        <ListRow
          icon="file"
          tone="teal"
          title={t('info.privacy.title')}
          onPress={() => router.push('/(customer)/info/privacy')}
        />
        <ListRow
          icon="file"
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

const styles = themedStyles(() => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: { flex: 1, fontFamily: fonts.semibold, fontSize: fontSizes.md, color: colors.text },
}));
