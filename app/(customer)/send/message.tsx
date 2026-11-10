import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { useGiftDraft } from '@/src/lib/gift-draft';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

const SUGGESTIONS = ['birthday', 'thankYou', 'congrats', 'justBecause'] as const;

export default function MessageScreen() {
  const { t } = useTranslation();
  const { draft, update } = useGiftDraft();
  const [message, setMessage] = useState(draft.message);

  function choose(suggestion: string) {
    setMessage(suggestion);
    update({ message: suggestion });
  }

  function next() {
    update({ message: message.trim() });
    router.push('/(customer)/send/wrapping');
  }

  return (
    <Screen>
      <FlowHeader
        title={t('send.messageTitle')}
        subtitle={t('send.messageSubtitle')}
        step={2}
        total={4}
        onBack={() => router.back()}
      />

      <TextField
        label={t('send.messageTitle')}
        value={message}
        onChangeText={setMessage}
        placeholder={t('send.messagePlaceholder')}
        multiline
        numberOfLines={5}
        style={styles.input}
      />

      <Text style={styles.label}>{t('send.suggested')}</Text>
      <View style={styles.suggestions}>
        {SUGGESTIONS.map((key) => (
          <Pressable
            key={key}
            onPress={() => choose(t(`send.suggestions.${key}`))}
            accessibilityRole="button"
            style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
          >
            <Card style={styles.suggestionCard}>
              <Text style={styles.suggestionText}>
                {t(`send.suggestions.${key}`)}
              </Text>
            </Card>
          </Pressable>
        ))}
      </View>

      <Button label={t('common.continue')} onPress={next} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 120, textAlignVertical: 'top' },
  label: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  suggestions: { gap: spacing.sm },
  suggestion: { borderRadius: 20 },
  suggestionCard: { paddingVertical: spacing.sm + 2 },
  suggestionText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text,
    lineHeight: 19,
  },
  pressed: { opacity: 0.85 },
});
