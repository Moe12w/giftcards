import { useThemeRefresh } from '@/src/lib/theme';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Chip } from '@/src/components/Chip';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Glyph } from '@/src/components/Glyph';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { useGiftDraft, type DeliveryMethod } from '@/src/lib/gift-draft';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '@/src/theme';

const METHODS: DeliveryMethod[] = ['email', 'sms', 'whatsapp', 'link'];

export default function DeliveryScreen() {
  useThemeRefresh();
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
                <Glyph
                  name={
                    method === 'email'
                      ? 'mail'
                      : method === 'sms'
                        ? 'smartphone'
                        : method === 'whatsapp'
                          ? 'message'
                          : 'link'
                  }
                  size={24}
                />
                <Text style={styles.methodLabel}>
                  {method === 'email'
                    ? t('send.deliveryEmail')
                    : method === 'sms'
                      ? t('send.deliverySms')
                      : method === 'whatsapp'
                        ? t('send.deliveryWhatsapp')
                        : t('send.deliveryLink')}
                </Text>
              </Card>
            </Pressable>
          );
        })}
      </View>

      {draft.deliveryMethod === 'whatsapp' ? (
        <Text style={styles.hint}>{t('send.deliveryWhatsappBody')}</Text>
      ) : null}

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

const styles = themedStyles(() => ({
  methods: { flexDirection: 'row', gap: spacing.sm },
  methodWrap: { flex: 1 },
  method: { alignItems: 'center', gap: 4, paddingVertical: spacing.sm + 2 },
  methodLabel: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    color: colors.text,
    textAlign: 'center',
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    lineHeight: 17,
  },
  modeRow: { flexDirection: 'row', gap: spacing.sm },
  pressed: { opacity: 0.9 },
}));
