import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/src/components/Avatar';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { MOCK_RECIPIENTS } from '@/src/lib/mock-data';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

export default function RecipientsScreen() {
  const { t } = useTranslation();
  const [recipients, setRecipients] = useState(MOCK_RECIPIENTS);

  return (
    <Screen>
      <FlowHeader title={t('profile.recipients')} onBack={() => router.back()} />

      {recipients.length === 0 ? (
        <EmptyState
          title={t('profile.noRecipients')}
          body={t('send.recipientSubtitle')}
          icon="users"
          tone="lavender"
        />
      ) : (
        <View style={styles.list}>
          {recipients.map((recipient) => (
            <Pressable
              key={recipient.id}
              onPress={() =>
                router.push({
                  pathname: '/(customer)/send/recipient-details',
                })
              }
              accessibilityRole="button"
              accessibilityLabel={recipient.name}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Card style={styles.row}>
                <Avatar name={recipient.name} size={46} tone="lavender" />
                <View style={styles.copy}>
                  <Text style={styles.name}>{recipient.name}</Text>
                  <Text style={styles.meta}>{recipient.email}</Text>
                </View>
                <Text
                  onPress={() =>
                    setRecipients((current) => current.filter((item) => item.id !== recipient.id))
                  }
                  style={styles.remove}
                >
                  {t('common.remove')}
                </Text>
              </Card>
            </Pressable>
          ))}
        </View>
      )}

      <Button
        label={t('send.addRecipient')}
        onPress={() => router.push('/(customer)/send/recipient-details')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  copy: { flex: 1, gap: 1 },
  name: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted },
  remove: { fontFamily: fonts.bold, fontSize: fontSizes.xs, color: colors.danger },
  pressed: { opacity: 0.88 },
});
