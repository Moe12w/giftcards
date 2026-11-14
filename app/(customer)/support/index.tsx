import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Badge, type BadgeTone } from '@/src/components/Badge';
import { Card } from '@/src/components/Card';
import { FlowHeader } from '@/src/components/FlowHeader';
import { ListRow } from '@/src/components/ListRow';
import { Screen } from '@/src/components/Screen';
import { listSupportRequests } from '@/src/lib/data';
import { formatDate } from '@/src/lib/time';
import type { SupportRequest } from '@/src/lib/types';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

const STATUS_TONE: Record<SupportRequest['status'], BadgeTone> = {
  open: 'warning',
  in_progress: 'info',
  resolved: 'success',
  closed: 'neutral',
};

export default function SupportScreen() {
  const { t, i18n } = useTranslation();
  const [requests, setRequests] = useState<SupportRequest[]>([]);

  // Every form on this screen writes a row to support_requests, so the same
  // list the admin inbox reads is the customer's own history here.
  useEffect(() => {
    let active = true;
    listSupportRequests()
      .then((rows) => active && setRequests(rows.slice(0, 20)))
      .catch(() => active && setRequests([]));
    return () => {
      active = false;
    };
  }, []);

  return (
    <Screen>
      <FlowHeader
        title={t('support.title')}
        subtitle={t('support.subtitle')}
        onBack={() => router.back()}
      />

      <Card>
        <ListRow
          icon="help"
          tone="teal"
          title={t('support.faq')}
          onPress={() => router.push('/(customer)/support/faq')}
        />
        <ListRow
          icon="mail"
          tone="pink"
          title={t('support.contact')}
          onPress={() => router.push('/(customer)/support/contact')}
        />
        {/* Live chat is not live yet, so it stays out of the menu until it is.
            The screen itself is still at support/chat for when it ships. */}
        <ListRow
          icon="warning"
          tone="gold"
          title={t('support.report')}
          onPress={() => router.push('/(customer)/support/report')}
        />
        <ListRow
          icon="mail"
          tone="teal"
          title={t('support.reportGift')}
          onPress={() => router.push('/(customer)/support/report-gift')}
        />
        <ListRow
          icon="message"
          tone="pink"
          title={t('support.refund')}
          onPress={() => router.push('/(customer)/support/refund')}
        />
        <ListRow
          icon="warning"
          tone="lavender"
          title={t('support.refundStatus')}
          last
          onPress={() => router.push('/(customer)/support/refund-status')}
        />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{t('supportTickets.yourRequests')}</Text>
        {requests.length === 0 ? (
          <Text style={styles.note}>{t('supportTickets.noRequests')}</Text>
        ) : (
          requests.map((request) => (
            <Pressable
              key={request.id}
              style={styles.ticketRow}
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/(customer)/support/ticket/[id]',
                  params: { id: request.id },
                })
              }
            >
              <View style={styles.ticketCopy}>
                <Text style={styles.ticketTitle} numberOfLines={1}>
                  {request.subject || t('support.title')}
                </Text>
                <Text style={styles.ticketMeta}>
                  {formatDate(request.created_at, i18n.language)}
                </Text>
              </View>
              <Badge
                label={t(`supportTickets.status.${request.status}`)}
                tone={STATUS_TONE[request.status] ?? 'neutral'}
              />
            </Pressable>
          ))
        )}
      </Card>

      <Text style={styles.note}>{t('support.contactBody')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 20,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  ticketCopy: { flex: 1, gap: 1 },
  ticketTitle: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.text },
  ticketMeta: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
});
