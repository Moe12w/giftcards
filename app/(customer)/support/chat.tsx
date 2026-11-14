import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { createSupportRequest } from '@/src/lib/data';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

interface ChatMessage {
  id: string;
  from: 'user' | 'agent';
  text: string;
}

export default function ChatScreen() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', from: 'agent', text: t('support.chatBody') },
  ]);
  const [draft, setDraft] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Live chat is stored as a support ticket, so the conversation reaches the
   * admin inbox even when no agent is online. The whole thread is sent with
   * each message and the admin reads it in the support queue.
   */
  async function send() {
    const text = draft.trim();
    if (!text) return;

    const nextMessages: ChatMessage[] = [
      ...messages,
      { id: `u-${Date.now()}`, from: 'user', text },
    ];
    setMessages(nextMessages);
    setDraft('');
    setError(null);

    const transcript = nextMessages
      .filter((message) => message.from === 'user')
      .map((message) => message.text)
      .join('\n\n');

    try {
      await createSupportRequest({
        kind: 'chat',
        subject: t('support.chatTitle'),
        body: transcript,
      });
      setSent(true);
    } catch {
      setError(t('supportTickets.sendFailed'));
    }
  }

  return (
    <Screen>
      <FlowHeader title={t('support.chatTitle')} onBack={() => router.back()} />

      <View style={styles.thread}>
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.bubble,
              message.from === 'user' ? styles.userBubble : styles.agentBubble,
            ]}
          >
            <Text
              style={[
                styles.bubbleText,
                message.from === 'user' && styles.userText,
              ]}
            >
              {message.text}
            </Text>
          </View>
        ))}
        {sent ? <Text style={styles.sent}>{t('supportTickets.chatSent')}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.composer}>
        <TextField
          placeholder={t('support.chatPlaceholder')}
          value={draft}
          onChangeText={setDraft}
          style={styles.input}
        />
        <Pressable onPress={send} style={styles.sendButton} accessibilityRole="button">
          <Text style={styles.sendText}>{t('support.send')}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  thread: { flex: 1, gap: spacing.sm },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: spacing.sm,
  },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.teal },
  agentBubble: { alignSelf: 'flex-start', backgroundColor: colors.surface },
  bubbleText: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.text },
  userText: { color: colors.textOnAccent },
  sent: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.success },
  error: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.danger },
  composer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: { flex: 1 },
  sendButton: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.plum,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sendText: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.textOnAccent },
});
