import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Chip } from '@/src/components/Chip';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { GiftBox3D } from '@/src/components/GiftBox3D';
import { Money } from '@/src/components/Money';
import { ParticipantStack } from '@/src/components/ParticipantStack';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { useAuth } from '@/src/lib/auth';
import { basketTotal, useBaskets } from '@/src/lib/baskets';
import { formatMoney } from '@/src/lib/money';
import type { DeliveryMethod } from '@/src/lib/gift-draft';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

const METHODS: DeliveryMethod[] = ['email', 'sms', 'link'];

export default function SendBasketScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { ready, getBasket, sendBasket } = useBaskets();
  const basket = id ? getBasket(id) : null;

  const [name, setName] = useState(basket?.recipient_name ?? '');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState<DeliveryMethod>('email');
  const [message, setMessage] = useState(basket?.note ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  const lang = i18n.language === 'ar' ? 'ar' : 'en';
  const isOwner = basket ? basket.creator_id === (user?.id ?? 'demo-user') : false;

  // Baskets hydrate from AsyncStorage, so prefill once the record is available
  // without overwriting anything the creator has already typed.
  useEffect(() => {
    if (!basket) return;
    setName((prev) => prev || basket.recipient_name);
    setMessage((prev) => prev || basket.note || '');
  }, [basket]);

  function send() {
    if (!basket || sending) return;
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = t('common.required');
    if (method === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = t('auth.invalidEmail');
    }
    if (method === 'sms' && phone.trim().length < 6) nextErrors.phone = t('common.required');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSending(true);
    // Delivery is queued by the backend after the payment provider settles in
    // production. Demo mode completes after a short simulated hand-off.
    setTimeout(() => {
      sendBasket(basket.id, { recipientName: name.trim(), message: message.trim() });
      // Close the send screen and the basket screen beneath it, then open the
      // finished basket fresh so Back returns to the tabs, not to this form.
      if (router.canDismiss()) {
        router.dismissAll();
        router.push(`/(customer)/basket/${basket.id}?sent=1`);
        return;
      }
      router.replace(`/(customer)/basket/${basket.id}?sent=1`);
    }, 900);
  }

  if (!ready) {
    return (
      <Screen>
        <FlowHeader title={t('basket.sendTitle')} onBack={() => router.back()} />
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      </Screen>
    );
  }

  if (!basket) {
    return (
      <Screen>
        <FlowHeader title={t('basket.sendTitle')} onBack={() => router.back()} />
        <EmptyState
          title={t('states.not-found.title')}
          body={t('states.not-found.body')}
          icon="🎁"
          tone="lavender"
        />
      </Screen>
    );
  }

  if (!isOwner) {
    return (
      <Screen>
        <FlowHeader title={t('basket.sendTitle')} onBack={() => router.back()} />
        <EmptyState
          title={t('basket.onlyOwnerTitle')}
          body={t('basket.onlyOwnerBody')}
          icon="🔒"
          tone="lavender"
        />
        <Button label={t('basket.backToBaskets')} onPress={() => router.back()} />
      </Screen>
    );
  }

  if (basket.status === 'completed') {
    return (
      <Screen>
        <FlowHeader title={t('basket.sendTitle')} onBack={() => router.back()} />
        <EmptyState
          title={t('basket.completedTitle')}
          body={t('basket.completedBody')}
          icon="🎉"
          tone="gold"
        />
        <Button label={t('basket.backToBaskets')} onPress={() => router.back()} />
      </Screen>
    );
  }

  const total = basketTotal(basket);

  return (
    <Screen>
      <FlowHeader
        title={t('basket.sendTitle')}
        subtitle={t('basket.sendSubtitle')}
        onBack={() => router.back()}
      />

      <Card tone="gold" style={styles.hero}>
        <GiftBox3D basket={basket} size={170} showMeta={false} />
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{basket.items.length}</Text>
            <Text style={styles.heroLabel}>{t('basket.giftCards')}</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{basket.participants.length}</Text>
            <Text style={styles.heroLabel}>{t('basket.contributors')}</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Money minor={total} style={styles.heroTotal} />
            <Text style={styles.heroLabel}>{t('basket.totalValue')}</Text>
          </View>
        </View>
        <View style={styles.peopleRow}>
          <ParticipantStack participants={basket.participants} size={28} max={5} />
          <Text style={styles.peopleText} numberOfLines={1}>
            {t('basket.byCreator', { name: basket.creator_name })}
          </Text>
        </View>
      </Card>

      <Card tone="teal" style={styles.info}>
        <Sparkles size={18} color={colors.ink} />
        <Text style={styles.infoText}>{t('basket.sendBody')}</Text>
      </Card>

      <Card style={styles.form}>
        <Text style={styles.sectionTitle}>{t('basket.sendTo')}</Text>
        <TextField
          label={t('send.recipientName')}
          value={name}
          onChangeText={(value) => {
            setName(value);
            setErrors((prev) => ({ ...prev, name: '' }));
          }}
          autoCapitalize="words"
          error={errors.name}
        />
        <View style={styles.methods}>
          {METHODS.map((entry) => (
            <Chip
              key={entry}
              label={
                entry === 'email'
                  ? t('send.deliveryEmail')
                  : entry === 'sms'
                    ? t('send.deliverySms')
                    : t('send.deliveryLink')
              }
              active={method === entry}
              onPress={() => setMethod(entry)}
            />
          ))}
        </View>
        {method === 'email' ? (
          <TextField
            label={t('send.recipientEmail')}
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setErrors((prev) => ({ ...prev, email: '' }));
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />
        ) : null}
        {method === 'sms' ? (
          <TextField
            label={t('send.recipientPhone')}
            value={phone}
            onChangeText={(value) => {
              setPhone(value);
              setErrors((prev) => ({ ...prev, phone: '' }));
            }}
            keyboardType="phone-pad"
            error={errors.phone}
          />
        ) : null}
        <TextField
          label={t('basket.sendMessage')}
          value={message}
          onChangeText={setMessage}
          placeholder={t('basket.sendMessagePlaceholder', { name: name.trim() || basket.recipient_name })}
          multiline
          numberOfLines={4}
          style={styles.messageInput}
        />
      </Card>

      <Card style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('basket.sendSummary')}</Text>
          <Text style={styles.summaryValue}>
            {t('basket.sendSummaryValue', {
              count: basket.items.length,
              amount: formatMoney(total, lang),
            })}
          </Text>
        </View>
      </Card>

      <Button
        label={t('basket.sendConfirm')}
        onPress={send}
        loading={sending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxl },
  hero: { gap: spacing.sm, alignItems: 'stretch' },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: spacing.sm,
  },
  heroStat: { flex: 1, alignItems: 'center', gap: 0 },
  heroValue: { fontFamily: fonts.extrabold, fontSize: fontSizes.xl, color: colors.text },
  heroTotal: { fontSize: fontSizes.lg, color: colors.text },
  heroLabel: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  heroDivider: { width: 1, height: 28, backgroundColor: colors.borderSoft },
  peopleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  peopleText: { flex: 1, fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  info: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  infoText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text,
    lineHeight: 18,
  },
  form: { gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  messageInput: { minHeight: 96, textAlignVertical: 'top' },
  summary: {},
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  summaryLabel: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.textMuted },
  summaryValue: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.text,
    textAlign: 'right',
  },
});
