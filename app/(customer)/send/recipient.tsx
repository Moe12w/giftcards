import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/src/components/Avatar';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { ListRow } from '@/src/components/ListRow';
import { Screen } from '@/src/components/Screen';
import { useGiftDraft } from '@/src/lib/gift-draft';
import { MOCK_RECIPIENTS } from '@/src/lib/mock-data';
import type { Recipient } from '@/src/lib/types';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

export default function SendRecipientScreen() {
  const { t } = useTranslation();
  const { draft, update } = useGiftDraft();

  function choose(recipient: Recipient) {
    update({ recipient });
    router.push('/(customer)/send/delivery');
  }

  return (
    <Screen>
      <FlowHeader
        title={t('send.recipientTitle')}
        subtitle={t('send.recipientSubtitle')}
        step={0}
        total={4}
        onBack={() => router.back()}
      />

      {draft.recipient ? (
        <Card tone="teal" style={styles.selected}>
          <Text style={styles.selectedLabel}>{t('send.recipientTitle')}</Text>
          <Text style={styles.selectedName}>{draft.recipient.name}</Text>
          <Text style={styles.selectedEmail}>{draft.recipient.email}</Text>
        </Card>
      ) : null}

      {MOCK_RECIPIENTS.length === 0 ? (
        <EmptyState
          title={t('profile.noRecipients')}
          body={t('send.recipientSubtitle')}
          icon="👥"
          tone="lavender"
        />
      ) : (
        <View style={styles.list}>
          {MOCK_RECIPIENTS.map((recipient) => (
            <Pressable
              key={recipient.id}
              onPress={() => choose(recipient)}
              accessibilityRole="button"
              accessibilityLabel={recipient.name}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Card style={styles.rowCard}>
                <Avatar name={recipient.name} size={48} tone="lavender" />
                <View style={styles.rowCopy}>
                  <Text style={styles.rowName}>{recipient.name}</Text>
                  <Text style={styles.rowMeta}>{recipient.email}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Card>
            </Pressable>
          ))}
        </View>
      )}

      <Card style={styles.actions}>
        <ListRow
          icon="✍️"
          tone="teal"
          title={t('send.addRecipient')}
          onPress={() => router.push('/(customer)/send/recipient-details')}
        />
        <ListRow
          icon="📇"
          tone="pink"
          title={t('send.contacts')}
          last
          onPress={() => router.push('/(customer)/send/contacts')}
        />
      </Card>

      <Button label={t('common.continue')} onPress={() => router.push('/(customer)/send/delivery')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  selected: { gap: 2 },
  selectedLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  selectedName: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  selectedEmail: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  list: { gap: spacing.sm },
  row: { borderRadius: 20 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowCopy: { flex: 1, gap: 1 },
  rowName: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  rowMeta: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  chevron: { fontSize: 24, color: colors.textMuted },
  actions: { paddingVertical: 0 },
  pressed: { opacity: 0.85 },
});
