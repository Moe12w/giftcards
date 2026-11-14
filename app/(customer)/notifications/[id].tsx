import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { IconTile, type IconTileTone } from '@/src/components/IconTile';
import { Screen } from '@/src/components/Screen';
import { listNotifications, markNotificationRead } from '@/src/lib/data';
import { useThemeRefresh } from '@/src/lib/theme';
import { formatDate } from '@/src/lib/time';
import type { AppNotification, NotificationKind } from '@/src/lib/types';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';

const KIND_ICON: Record<NotificationKind, string> = {
  received: 'gift',
  delivered: 'mail',
  opened: 'eye',
  redeemed: 'check',
  expiry: 'clock',
  promo: 'justBecause',
  support: 'message',
};

const KIND_TONE: Record<NotificationKind, IconTileTone> = {
  received: 'pink',
  delivered: 'teal',
  opened: 'lavender',
  redeemed: 'teal',
  expiry: 'gold',
  promo: 'lavender',
  support: 'teal',
};

export default function NotificationDetailScreen() {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<AppNotification | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      const rows = await listNotifications();
      const found = rows.find((row) => row.id === id) ?? null;
      setItem(found);
      if (found && !found.read) {
        await markNotificationRead(found.id);
        setItem({ ...found, read: true });
      }
    } catch {
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <Screen>
        <FlowHeader title={t('notifications.detailTitle')} onBack={() => router.back()} />
      </Screen>
    );
  }

  if (!item) {
    return (
      <Screen>
        <FlowHeader title={t('notifications.detailTitle')} onBack={() => router.back()} />
        <EmptyState
          title={t('states.not-found.title')}
          body={t('states.not-found.body')}
          icon="bell"
          tone="lavender"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlowHeader title={t('notifications.detailTitle')} onBack={() => router.back()} />

      <Card tone="teal" style={styles.card}>
        <IconTile
          icon={KIND_ICON[item.kind] ?? 'bell'}
          size={64}
          tone={KIND_TONE[item.kind] ?? 'lavender'}
        />
        <Text style={styles.title}>{t(item.titleKey)}</Text>
        <Text style={styles.date}>{formatDate(item.created_at, i18n.language)}</Text>
        <Text style={styles.body}>{t(item.bodyKey)}</Text>
      </Card>

      {item.gift_id ? (
        <Button
          label={t('notifications.viewGift')}
          onPress={() => router.push(`/(customer)/card/${item.gift_id}`)}
        />
      ) : null}
      {item.support_request_id ? (
        <Button
          label={t('notifications.viewTicket')}
          onPress={() =>
            router.push({
              pathname: '/(customer)/support/ticket/[id]',
              params: { id: item.support_request_id as string },
            })
          }
        />
      ) : null}
      <Button label={t('common.back')} variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = themedStyles(() => ({
  card: { alignItems: 'center', gap: spacing.xs },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xl,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  date: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: spacing.xs,
  },
}));
