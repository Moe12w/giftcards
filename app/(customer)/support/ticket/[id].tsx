import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Badge, type BadgeTone } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import {
  getSupportRequest,
  listSupportMessages,
  replyToSupportRequest,
  type SupportMessage,
} from '@/src/lib/data';
import { formatDate, formatDateTime } from '@/src/lib/time';
import { useThemeRefresh } from '@/src/lib/theme';
import type { SupportRequest } from '@/src/lib/types';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';

const STATUS_TONE: Record<SupportRequest['status'], BadgeTone> = {
  open: 'warning',
  in_progress: 'info',
  resolved: 'success',
  closed: 'neutral',
};

export default function SupportTicketScreen() {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [request, setRequest] = useState<SupportRequest | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      const [row, thread] = await Promise.all([
        getSupportRequest(id),
        listSupportMessages(id),
      ]);
      setRequest(row);
      setMessages(thread);
    } catch {
      setRequest(null);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function sendReply() {
    const body = draft.trim();
    if (!body || !id) return;
    setError(null);
    setSending(true);
    try {
      await replyToSupportRequest(id, body);
      setDraft('');
      await load();
    } catch {
      setError(t('supportTickets.replyFailed'));
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <FlowHeader title={t('supportTickets.yourRequests')} onBack={() => router.back()} />
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      </Screen>
    );
  }

  if (!request) {
    return (
      <Screen>
        <FlowHeader title={t('supportTickets.yourRequests')} onBack={() => router.back()} />
        <EmptyState
          title={t('states.not-found.title')}
          body={t('states.not-found.body')}
          icon="receipt"
          tone="lavender"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlowHeader
        title={request.subject || t('support.title')}
        subtitle={formatDate(request.created_at, i18n.language)}
        onBack={() => router.back()}
      />

      <Card>
        <View style={styles.ticketHead}>
          <Text style={styles.ticketBody}>{request.body}</Text>
          <Badge
            label={t(`supportTickets.status.${request.status}`)}
            tone={STATUS_TONE[request.status] ?? 'neutral'}
          />
        </View>
        {request.reference ? (
          <Text style={styles.meta}>
            {request.reference}
          </Text>
        ) : null}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{t('supportTickets.thread')}</Text>
        {messages.length === 0 ? (
          <Text style={styles.meta}>{t('supportTickets.noReplies')}</Text>
        ) : (
          messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.bubble,
                message.author_role === 'admin' ? styles.teamBubble : styles.userBubble,
              ]}
            >
              <Text style={styles.bubbleAuthor}>
                {message.author_role === 'admin'
                  ? t('supportTickets.supportTeam')
                  : message.author_name}{' '}
                · {formatDateTime(message.created_at, i18n.language)}
              </Text>
              <Text style={styles.bubbleText}>{message.body}</Text>
            </View>
          ))
        )}
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TextField
        label={t('supportTickets.reply')}
        value={draft}
        onChangeText={setDraft}
        placeholder={t('supportTickets.replyPlaceholder')}
        multiline
        style={styles.input}
      />
      <Button
        label={t('supportTickets.sendReply')}
        onPress={sendReply}
        disabled={!draft.trim() || sending}
      />
    </Screen>
  );
}

const styles = themedStyles(() => ({
  loader: { marginVertical: spacing.lg },
  ticketHead: { gap: spacing.sm, alignItems: 'flex-start' },
  ticketBody: { fontFamily: fonts.regular, fontSize: fontSizes.md, color: colors.text, lineHeight: 22 },
  meta: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  bubble: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: spacing.sm,
    gap: 2,
    maxWidth: '88%',
  },
  teamBubble: { alignSelf: 'flex-start', backgroundColor: colors.lavenderTint },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.tealTint },
  bubbleAuthor: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  bubbleText: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.text },
  input: { minHeight: 100, textAlignVertical: 'top' },
  error: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.danger,
    textAlign: 'center',
  },
}));
