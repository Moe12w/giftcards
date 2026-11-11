import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Card } from '@/src/components/Card';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { getPreferences, savePreferences } from '@/src/lib/data';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

interface ToggleRowProps {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

function ToggleRow({ label, value, onValueChange }: ToggleRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.borderSoft, true: colors.teal }}
        thumbColor={colors.surface}
        ios_backgroundColor={colors.borderSoft}
      />
    </View>
  );
}

export default function NotificationPreferencesScreen() {
  const { t } = useTranslation();
  const [giftUpdates, setGiftUpdates] = useState(true);
  const [promotions, setPromotions] = useState(false);
  const [expiry, setExpiry] = useState(true);
  const [email, setEmail] = useState(true);
  const [push, setPush] = useState(true);
  const [sms, setSms] = useState(false);

  useEffect(() => {
    getPreferences()
      .then((rows) => {
        setGiftUpdates(rows.gift_updates);
        setPromotions(rows.promotions);
        setExpiry(rows.expiry_reminders);
        setEmail(rows.email);
        setPush(rows.push);
        setSms(rows.sms);
      })
      .catch(() => undefined);
  }, []);

  return (
    <Screen>
      <FlowHeader
        title={t('notifications.preferences')}
        subtitle={t('notifications.subtitle')}
        onBack={() => router.back()}
      />

      <Card>
        <ToggleRow
          label={t('notifications.giftUpdates')}
          value={giftUpdates}
          onValueChange={(value) => {
            setGiftUpdates(value);
            savePreferences({ gift_updates: value }).catch(() => undefined);
          }}
        />
        <ToggleRow
          label={t('notifications.promotions')}
          value={promotions}
          onValueChange={(value) => {
            setPromotions(value);
            savePreferences({ promotions: value }).catch(() => undefined);
          }}
        />
        <ToggleRow
          label={t('notifications.expiryReminders')}
          value={expiry}
          onValueChange={(value) => {
            setExpiry(value);
            savePreferences({ expiry_reminders: value }).catch(() => undefined);
          }}
        />
      </Card>

      <Card>
        <ToggleRow
          label={t('notifications.email')}
          value={email}
          onValueChange={(value) => {
            setEmail(value);
            savePreferences({ email: value }).catch(() => undefined);
          }}
        />
        <ToggleRow
          label={t('notifications.push')}
          value={push}
          onValueChange={(value) => {
            setPush(value);
            savePreferences({ push: value }).catch(() => undefined);
          }}
        />
        <ToggleRow
          label={t('notifications.sms')}
          value={sms}
          onValueChange={(value) => {
            setSms(value);
            savePreferences({ sms: value }).catch(() => undefined);
          }}
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
  rowLabel: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
});
