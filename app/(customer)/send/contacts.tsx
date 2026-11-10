import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/src/components/Avatar';
import { Card } from '@/src/components/Card';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { useGiftDraft } from '@/src/lib/gift-draft';
import { MOCK_RECIPIENTS } from '@/src/lib/mock-data';
import type { Recipient } from '@/src/lib/types';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

const CONTACTS: Recipient[] = [
  ...MOCK_RECIPIENTS,
  { id: 'contact-5', name: 'Mariam Saleh', email: 'mariam@example.com', phone: '+974 5555 0505' },
  { id: 'contact-6', name: 'Yousef Nasser', email: 'yousef@example.com', phone: '+974 5555 0606' },
];

export default function ContactsScreen() {
  const { t } = useTranslation();
  const { update } = useGiftDraft();

  function choose(recipient: Recipient) {
    update({ recipient });
    router.push('/(customer)/send/delivery');
  }

  return (
    <Screen>
      <FlowHeader title={t('send.contacts')} onBack={() => router.back()} />

      <View style={styles.list}>
        {CONTACTS.map((contact) => (
          <Pressable
            key={contact.id}
            onPress={() => choose(contact)}
            accessibilityRole="button"
            accessibilityLabel={contact.name}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Card style={styles.rowCard}>
              <Avatar name={contact.name} size={44} tone="teal" />
              <View style={styles.copy}>
                <Text style={styles.name}>{contact.name}</Text>
                <Text style={styles.meta}>{contact.email}</Text>
              </View>
              <Text style={styles.add}>{t('common.add')}</Text>
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { borderRadius: 20 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  copy: { flex: 1, gap: 1 },
  name: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted },
  add: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.tealDark },
  pressed: { opacity: 0.85 },
});
