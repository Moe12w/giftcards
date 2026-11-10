import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Chip } from '@/src/components/Chip';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { useGiftDraft, type DeliveryMethod } from '@/src/lib/gift-draft';
import { colors, fonts, fontSizes, radii, spacing } from '@/src/theme';

const METHODS: DeliveryMethod[] = ['email', 'sms', 'link'];

export default function DeliveryScreen() {
  const { t } = useTranslation();
  const { draft, update } = useGiftDraft();
  const [mode, setMode] = useState<'now' | 'schedule'>(
    draft.deliveryDate ? 'schedule' : 'now',
  );
  const [dateText, setDateText] = useState(draft.deliveryDate ? draft.deliveryDate.slice(0, 10) : '');
  const [error, setError] = useState<string | null>(null);

  function chooseMethod(method: DeliveryMethod) {
    update({ deliveryMethod: method });
  }

  function next() {
    if (mode === 'schedule') {
      const parsed = new Date(dateText);
      if (!dateText.trim() || Number.isNaN(parsed.getTime())) {
        setError(t('common.required'));
        return;
      }
      update({ deliveryDate: parsed.toISOString() });
    } else {
      update({ deliveryDate: null });
    }
    setError(null);
    router.push('/(customer)/send/message');
  }

  return (
    <Screen>
      <FlowHeader
        title={t('send.deliveryTitle')}
        subtitle={t('send.deliverySubtitle')}
        step={1}
        total={4}
        onBack={() => router.back()}
      />

      <View style={styles.methods}>
        {METHODS.map((method) => {
          const active = draft.deliveryMethod === method;
          return (
            <Pressable
              key={method}
              onPress={() => chooseMethod(method)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [styles.methodWrap, pressed && styles.pressed]}
            >
              <Card tone={active ? 'teal' : 'surface'} style={styles.method}>
                <Text style={styles.methodEmoji}>
                  {method === 'email' ? '✉️' : method === 'sms' ? '💬' : '🔗'}
                </Text>
                <Text style={styles.methodLabel}>
                  {method === 'email'
                    ? t('send.deliveryEmail')
                    : method === 'sms'
                      ? t('send.deliverySms')
                      : t('send.deliveryLink')}
                </Text>
              </Card>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.modeRow}>
        <Chip
          label={t('send.deliveryNow')}
          active={mode === 'now'}
          onPress={() => setMode('now')}
        />
        <Chip
          label={t('send.deliverySchedule')}
          active={mode === 'schedule'}
          onPress={() => setMode('schedule')}
        />
      </View>

      {mode === 'schedule' ? (
        <TextField
          label={t('send.deliveryDate')}
          value={dateText}
          onChangeText={setDateText}
          placeholder="2026-12-24"
          error={error ?? undefined}
        />
      ) : null}

      <Button label={t('common.continue')} onPress={next} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  methods: { flexDirection: 'row', gap: spacing.sm },
  methodWrap: { flex: 1 },
  method: { alignItems: 'center', gap: 4, paddingVertical: spacing.sm + 2 },
  methodEmoji: { fontSize: 26 },
  methodLabel: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    color: colors.text,
    textAlign: 'center',
  },
  modeRow: { flexDirection: 'row', gap: spacing.sm },
  pressed: { opacity: 0.9 },
});
