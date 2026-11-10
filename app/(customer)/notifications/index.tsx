import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { IconTile, type IconTileTone } from '@/src/components/IconTile';
import { Screen } from '@/src/components/Screen';
import { MOCK_NOTIFICATIONS } from '@/src/lib/mock-data';
import { formatDate } from '@/src/lib/time';
import type { NotificationKind } from '@/src/lib/types';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

const KIND_ICON: Record<NotificationKind, string> = {
  received: 'gift',
  delivered: 'mail',
  opened: 'eye',
  redeemed: 'check',
  expiry: 'clock',
  promo: 'justBecause',
};

const KIND_TONE: Record<NotificationKind, IconTileTone> = {
  received: 'pink',
  delivered: 'teal',
  opened: 'lavender',
  redeemed: 'teal',
  expiry: 'gold',
  promo: 'lavender',
};

export default function NotificationsScreen() {
  const { t, i18n } = useTranslation();
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const unread = notifications.filter((item) => !item.read).length;

  function markAllRead() {
    setNotifications((items) => items.map((item) => ({ ...item, read: true })));
  }

  return (
    <Screen>
      <FlowHeader
        title={t('notifications.title')}
        subtitle={t('notifications.subtitle')}
        onBack={() => router.back()}
      />

      <View style={styles.actions}>
        {unread > 0 ? <Badge label={String(unread)} tone="danger" /> : null}
        <Button
          label={t('notifications.markAllRead')}
          variant="secondary"
          fullWidth={false}
          onPress={markAllRead}
        />
      </View>

      {notifications.length === 0 ? (
        <EmptyState
          title={t('notifications.emptyTitle')}
          body={t('notifications.emptyBody')}
          icon="bell"
          tone="lavender"
        />
      ) : (
        <View style={styles.list}>
          {notifications.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => router.push(`/(customer)/notifications/${item.id}`)}
              accessibilityRole="button"
              accessibilityLabel={t(item.titleKey)}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Card tone={item.read ? 'surface' : 'teal'} style={styles.item}>
                <IconTile
                  icon={KIND_ICON[item.kind]}
                  size={46}
                  tone={KIND_TONE[item.kind]}
                />
                <View style={styles.copy}>
                  <Text style={styles.title}>{t(item.titleKey)}</Text>
                  <Text style={styles.body} numberOfLines={2}>
                    {t(item.bodyKey)}
                  </Text>
                  <Text style={styles.date}>
                    {formatDate(item.created_at, i18n.language)}
                  </Text>
                </View>
                {!item.read ? <View style={styles.dot} /> : null}
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { gap: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  copy: { flex: 1, gap: 1 },
  title: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted, lineHeight: 18 },
  date: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.pink,
    borderWidth: 1,
    borderColor: colors.ink,
  },
  pressed: { opacity: 0.88 },
});
