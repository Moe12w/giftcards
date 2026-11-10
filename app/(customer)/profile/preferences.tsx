import React, { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Card } from '@/src/components/Card';
import { FlowHeader } from '@/src/components/FlowHeader';
import { ListRow } from '@/src/components/ListRow';
import { Screen } from '@/src/components/Screen';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

export default function PreferencesScreen() {
  const { t } = useTranslation();
  const [darkMode, setDarkMode] = useState(false);
  const [biometrics, setBiometrics] = useState(true);

  return (
    <Screen>
      <FlowHeader
        title={t('profile.preferences')}
        subtitle={t('profile.preferencesBody')}
        onBack={() => router.back()}
      />

      <Card>
        <View style={styles.row}>
          <Text style={styles.label}>{t('profile.darkMode')}</Text>
          <Switch
            value={darkMode}
            onValueChange={setDarkMode}
            trackColor={{ false: colors.borderSoft, true: colors.teal }}
            thumbColor={colors.surface}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t('profile.biometrics')}</Text>
          <Switch
            value={biometrics}
            onValueChange={setBiometrics}
            trackColor={{ false: colors.borderSoft, true: colors.teal }}
            thumbColor={colors.surface}
          />
        </View>
      </Card>

      <Card>
        <ListRow
          icon="🌐"
          tone="lavender"
          title={t('profile.language')}
          onPress={() => router.push('/(customer)/profile/language')}
        />
        <ListRow
          icon="🔔"
          tone="pink"
          title={t('profile.notifications')}
          last
          onPress={() => router.push('/(customer)/notifications/preferences')}
        />
      </Card>
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
