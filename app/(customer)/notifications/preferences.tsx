import React, { useEffect, useState } from 'react';
import { Linking, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { useAuth } from '@/src/lib/auth';
import { getPreferences, savePreferences } from '@/src/lib/data';
import {
  enablePushNotifications,
  getPushPermission,
  type PushPermission,
} from '@/src/lib/push';
import { useThemeRefresh } from '@/src/lib/theme';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';

interface ToggleRowProps {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({ label, value, onValueChange, disabled = false }: ToggleRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.borderSoft, true: colors.teal }}
        thumbColor={colors.surface}
        ios_backgroundColor={colors.borderSoft}
      />
    </View>
  );
}

export default function NotificationPreferencesScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [giftUpdates, setGiftUpdates] = useState(true);
  const [promotions, setPromotions] = useState(false);
  const [expiry, setExpiry] = useState(true);
  const [email, setEmail] = useState(true);
  const [push, setPush] = useState(true);
  const [sms, setSms] = useState(false);
  // The push toggle is only meaningful with the OS permission, so it shows the
  // device's real status instead of just the saved preference.
  const [pushPermission, setPushPermission] = useState<PushPermission | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

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
    getPushPermission()
      .then(setPushPermission)
      .catch(() => setPushPermission('denied'));
  }, []);

  async function togglePush(value: boolean) {
    if (!value) {
      setPush(false);
      savePreferences({ push: false }).catch(() => undefined);
      return;
    }
    if (!user?.id) return;
    setPushBusy(true);
    try {
      // Same flow as the priming card: raises the system prompt if it has not
      // been answered yet, and registers the device only if permission is
      // granted. A denial brings the person back here with the settings hint.
      const granted = await enablePushNotifications(user.id);
      setPushPermission(await getPushPermission());
      setPush(granted);
      if (granted) savePreferences({ push: true }).catch(() => undefined);
    } finally {
      setPushBusy(false);
    }
  }

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
          value={push && pushPermission === 'granted'}
          disabled={pushBusy}
          onValueChange={togglePush}
        />
        {pushPermission === 'denied' ? (
          <View style={styles.pushHint}>
            <Text style={styles.hintText}>{t('notifications.pushBlocked')}</Text>
            <Button
              label={t('notifications.pushOpenSettings')}
              variant="secondary"
              onPress={() => {
                Linking.openSettings().catch(() => undefined);
              }}
            />
          </View>
        ) : null}
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

const styles = themedStyles(() => ({
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
  pushHint: { gap: spacing.sm, paddingBottom: spacing.sm },
  hintText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 18,
  },
}));
