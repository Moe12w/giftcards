import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Badge, type BadgeTone } from '@/src/components/Badge';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { Money } from '@/src/components/Money';
import { Screen } from '@/src/components/Screen';
import { listMyOrders } from '@/src/lib/data';
import { useThemeRefresh } from '@/src/lib/theme';
import type { Order, OrderStatus } from '@/src/lib/types';
import { colors, fontSizes, spacing, themedStyles } from '@/src/theme';

const statusTone: Record<OrderStatus, BadgeTone> = {
  pending: 'warning',
  paid: 'success',
  failed: 'danger',
  refunded: 'info',
};

export default function OrdersScreen() {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listMyOrders()
      .then((data) => active && setOrders(data))
      .catch(() => undefined)
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>{t('orders.title')}</Text>
        <Text style={styles.subtitle}>{t('orders.subtitle')}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : orders.length === 0 ? (
        <EmptyState title={t('orders.noOrders')} body={t('orders.noOrdersBody')} icon="receipt" />
      ) : (
        <View style={styles.list}>
          {orders.map((order) => (
            <Card key={order.id} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.orderNumber}>
                  {t('orders.orderNumber', { number: order.payment_reference })}
                </Text>
                <Badge label={t(`orders.${order.status}`)} tone={statusTone[order.status]} />
              </View>
              <View style={styles.row}>
                <Text style={styles.muted}>
                  {t('orders.placedOn', {
                    date: new Date(order.created_at).toLocaleDateString(
                      i18n.language === 'ar' ? 'ar-QA' : 'en-QA',
                    ),
                  })}
                </Text>
                <Money minor={order.amount_minor} style={styles.total} />
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = themedStyles(() => ({
  header: { gap: spacing.xs, marginTop: spacing.sm },
  title: { fontSize: fontSizes.display, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: fontSizes.md, color: colors.textMuted },
  loader: { marginTop: spacing.xl },
  list: { gap: spacing.md },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  orderNumber: { fontSize: fontSizes.md, fontWeight: '700', color: colors.text },
  muted: { fontSize: fontSizes.sm, color: colors.textMuted },
  total: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.text },
}));
