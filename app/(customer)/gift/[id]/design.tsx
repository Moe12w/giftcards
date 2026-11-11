import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Chip } from '@/src/components/Chip';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Glyph } from '@/src/components/Glyph';
import { GiftCardVisual } from '@/src/components/GiftCardVisual';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { offerIcon, offerTitle, offerTone } from '@/src/lib/catalog';
import { getOffer } from '@/src/lib/data';
import { useGiftDraft, type DeliveryMethod } from '@/src/lib/gift-draft';
import { isUsablePhone, shareOnWhatsapp } from '@/src/lib/whatsapp';
import { formatMoney, toMinorUnits } from '@/src/lib/money';
import { useRecipients } from '@/src/lib/recipients';
import type { Offer } from '@/src/lib/types';
import { colors, fonts, fontSizes, radii, spacing } from '@/src/theme';

const DESIGNS = [
  { id: 'classic', background: colors.surface, edge: colors.ink, text: colors.ink, icon: 'gift' },
  { id: 'confetti', background: colors.pinkTint, edge: colors.pink, text: colors.ink, icon: 'congratulations' },
  { id: 'minimal', background: colors.tealTint, edge: colors.teal, text: colors.ink, icon: 'wellness' },
  { id: 'midnight', background: colors.plum, edge: colors.ink, text: colors.surface, icon: 'moon' },
] as const;

const DELIVERY_METHODS: DeliveryMethod[] = ['email', 'sms', 'whatsapp', 'link'];
const SUGGESTIONS = ['birthday', 'thankYou', 'congrats', 'justBecause'] as const;

export default function GiftComposeScreen() {
  const { recipients } = useRecipients();
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { draft, update, ready } = useGiftDraft();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);

  const [custom, setCustom] = useState('');
  const [recipientName, setRecipientName] = useState(draft.recipient?.name ?? '');
  const [recipientEmail, setRecipientEmail] = useState(draft.recipient?.email ?? '');
  const [recipientPhone, setRecipientPhone] = useState(draft.recipient?.phone ?? '');
  const [message, setMessage] = useState(draft.message);
  const [mode, setMode] = useState<'now' | 'schedule'>(
    draft.deliveryDate ? 'schedule' : 'now',
  );
  const [dateText, setDateText] = useState(
    draft.deliveryDate ? draft.deliveryDate.slice(0, 10) : '',
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const lang = i18n.language === 'ar' ? 'ar' : 'en';

  useEffect(() => {
    let active = true;
    if (!id) {
      setLoading(false);
      return;
    }
    getOffer(id)
      .then((data) => active && setOffer(data))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  // Starting from a different gift card resets the amount to that card's
  // suggested value while keeping the rest of the draft (recipient, message).
  useEffect(() => {
    if (offer && (draft.offerId !== offer.id || draft.amountMinor <= 0)) {
      update({
        offerId: offer.id,
        amountMinor: offer.preset_amounts_minor[1] ?? offer.min_amount_minor,
      });
      setCustom('');
    }
  }, [draft.amountMinor, draft.offerId, offer, update]);

  // The draft hydrates from AsyncStorage. If it lands after this screen mounts,
  // pull the saved recipient/message/date in once without clobbering edits.
  const hydrated = useRef(false);
  useEffect(() => {
    if (!ready || hydrated.current) return;
    hydrated.current = true;
    setRecipientName((prev) => prev || draft.recipient?.name || '');
    setRecipientEmail((prev) => prev || draft.recipient?.email || '');
    setRecipientPhone((prev) => prev || draft.recipient?.phone || '');
    setMessage((prev) => prev || draft.message || '');
    if (draft.deliveryDate) {
      setMode('schedule');
      setDateText((prev) => prev || draft.deliveryDate!.slice(0, 10));
    }
  }, [draft, ready]);

  if (loading) {
    return (
      <Screen>
        <FlowHeader title={t('gift.composeTitle')} onBack={() => router.back()} />
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      </Screen>
    );
  }

  if (!offer) {
    return (
      <Screen>
        <FlowHeader title={t('gift.composeTitle')} onBack={() => router.back()} />
        <EmptyState
          title={t('states.not-found.title')}
          body={t('states.not-found.body')}
          icon="gift"
          tone="lavender"
        />
      </Screen>
    );
  }

  const min = offer.min_amount_minor;
  const max = offer.max_amount_minor;
  const amount = draft.amountMinor;

  function chooseAmount(minor: number) {
    update({ amountMinor: minor });
    setCustom('');
    setErrors((prev) => ({ ...prev, amount: '' }));
  }

  function onChangeCustom(text: string) {
    setCustom(text);
    if (!text.trim()) return;
    try {
      const minor = toMinorUnits(text);
      update({ amountMinor: minor });
      setErrors((prev) => ({
        ...prev,
        amount: minor < min || minor > max ? t('offer.invalidAmount') : '',
      }));
    } catch {
      setErrors((prev) => ({ ...prev, amount: t('offer.invalidAmount') }));
    }
  }

  function chooseRecipient(name: string, email: string, phone?: string) {
    setRecipientName(name);
    setRecipientEmail(email);
    setRecipientPhone(phone ?? '');
    update({
      recipient: {
        id: draft.recipient?.id ?? `recipient-${Date.now()}`,
        name,
        email,
        phone,
      },
    });
    setErrors((prev) => ({ ...prev, recipientName: '', recipientEmail: '' }));
  }

  function next() {
    const nextErrors: Record<string, string> = {};
    if (custom.trim()) {
      try {
        const parsed = toMinorUnits(custom);
        if (parsed < min || parsed > max) nextErrors.amount = t('offer.invalidAmount');
      } catch {
        nextErrors.amount = t('offer.invalidAmount');
      }
    }
    if (amount < min || amount > max) nextErrors.amount = t('offer.invalidAmount');
    if (!recipientName.trim()) nextErrors.recipientName = t('common.required');
    if (draft.deliveryMethod === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())) {
      nextErrors.recipientEmail = t('auth.invalidEmail');
    }
    if (draft.deliveryMethod === 'sms' && recipientPhone.trim().length < 6) {
      nextErrors.recipientPhone = t('common.required');
    }
    if (draft.deliveryMethod === 'whatsapp' && !isUsablePhone(recipientPhone)) {
      nextErrors.recipientPhone = t('basket.whatsappNumber');
    }
    let deliveryDate: string | null = null;
    if (mode === 'schedule') {
      const parsed = new Date(dateText);
      if (!dateText.trim() || Number.isNaN(parsed.getTime())) {
        nextErrors.date = t('common.required');
      } else {
        deliveryDate = parsed.toISOString();
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    update({
      offerId: offer!.id,
      amountMinor: amount,
      recipient: {
        id: draft.recipient?.id ?? `recipient-${Date.now()}`,
        name: recipientName.trim(),
        email: recipientEmail.trim(),
        phone: recipientPhone.trim() || undefined,
      },
      message: message.trim(),
      deliveryDate,
    });
    router.push('/(customer)/checkout/payment');
  }

  const previewTone = offerTone(offer);

  return (
    <Screen>
      <FlowHeader
        title={t('gift.composeTitle')}
        subtitle={t('gift.composeSubtitle')}
        onBack={() => router.back()}
      />

      <GiftCardVisual
        compact
        title={offerTitle(offer, i18n.language)}
        icon={offerIcon(offer)}
        logoUrl={offer.vendor?.logo_url}
        tone={previewTone}
        amountMinor={amount}
        message={message || undefined}
        meta={recipientName.trim() ? `${t('send.recipientTitle')}: ${recipientName.trim()}` : undefined}
      />

      {/* Amount */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>{t('gift.amountTitle')}</Text>
        <View style={styles.presets}>
          {offer.preset_amounts_minor.map((preset) => (
            <Chip
              key={preset}
              label={formatMoney(preset, lang)}
              active={!custom && amount === preset}
              onPress={() => chooseAmount(preset)}
            />
          ))}
        </View>
        <TextField
          label={t('gift.customAmount')}
          value={custom}
          onChangeText={onChangeCustom}
          placeholder={t('gift.customAmountPlaceholder')}
          keyboardType="decimal-pad"
          error={errors.amount || undefined}
          hint={t('offer.minAmount', { amount: formatMoney(min, lang) })}
        />
      </Card>

      {/* Design */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>{t('gift.chooseDesign')}</Text>
        <View style={styles.designRow}>
          {DESIGNS.map((design) => {
            const active = draft.design === design.id;
            return (
              <Pressable
                key={design.id}
                onPress={() => update({ design: design.id })}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t(`gift.designs.${design.id}`)}
                style={({ pressed }) => [styles.designItem, pressed && styles.pressed]}
              >
                <View
                  style={[
                    styles.designSwatch,
                    {
                      backgroundColor: design.background,
                      borderColor: colors.ink,
                      borderBottomColor: design.edge,
                    },
                    active && styles.designSwatchActive,
                  ]}
                >
                  <Glyph name={design.icon} size={26} color={design.text} />
                </View>
                <Text style={[styles.designLabel, active && styles.designLabelActive]}>
                  {t(`gift.designs.${design.id}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* Recipient */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>{t('send.recipientTitle')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.recipientRow}
        >
          {recipients.slice(0, 5).map((recipient) => {
            const active = recipientEmail.trim().toLowerCase() === recipient.email.toLowerCase();
            return (
              <Chip
                key={recipient.id}
                label={recipient.name.split(' ')[0]}
                active={active}
                onPress={() => chooseRecipient(recipient.name, recipient.email, recipient.phone)}
              />
            );
          })}
        </ScrollView>
        <TextField
          label={t('send.recipientName')}
          value={recipientName}
          onChangeText={(value) => {
            setRecipientName(value);
            setErrors((prev) => ({ ...prev, recipientName: '' }));
          }}
          autoCapitalize="words"
          error={errors.recipientName}
        />
        {draft.deliveryMethod === 'email' ? (
          <TextField
            label={t('send.recipientEmail')}
            value={recipientEmail}
            onChangeText={(value) => {
              setRecipientEmail(value);
              setErrors((prev) => ({ ...prev, recipientEmail: '' }));
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.recipientEmail}
          />
        ) : null}
        {draft.deliveryMethod === 'sms' || draft.deliveryMethod === 'whatsapp' ? (
          <TextField
            label={t('send.recipientPhone')}
            value={recipientPhone}
            onChangeText={(value) => {
              setRecipientPhone(value);
              setErrors((prev) => ({ ...prev, recipientPhone: '' }));
            }}
            keyboardType="phone-pad"
            error={errors.recipientPhone}
          />
        ) : null}
      </Card>

      {/* Delivery */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>{t('send.deliveryTitle')}</Text>
        <View style={styles.chipRow}>
          {DELIVERY_METHODS.map((method) => (
            <Chip
              key={method}
              label={
                method === 'email'
                  ? t('send.deliveryEmail')
                  : method === 'sms'
                    ? t('send.deliverySms')
                    : t('send.deliveryLink')
              }
              active={draft.deliveryMethod === method}
              onPress={() => update({ deliveryMethod: method })}
            />
          ))}
        </View>
        <View style={styles.chipRow}>
          <Chip
            label={t('send.deliveryNow')}
            active={mode === 'now'}
            onPress={() => {
              setMode('now');
              setErrors((prev) => ({ ...prev, date: '' }));
            }}
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
            onChangeText={(value) => {
              setDateText(value);
              setErrors((prev) => ({ ...prev, date: '' }));
            }}
            placeholder="2026-12-24"
            error={errors.date}
          />
        ) : null}
      </Card>

      {/* Message */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>{t('send.messageTitle')}</Text>
        <TextField
          value={message}
          onChangeText={setMessage}
          placeholder={t('send.messagePlaceholder')}
          multiline
          numberOfLines={4}
          style={styles.messageInput}
        />
        <View style={styles.chipRow}>
          {SUGGESTIONS.map((key) => (
            <Chip
              key={key}
              label={t(`send.suggestionShort.${key}`)}
              active={false}
              onPress={() => setMessage(t(`send.suggestions.${key}`))}
            />
          ))}
        </View>
      </Card>

      <Button label={t('gift.continueToPayment')} onPress={next} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxl },
  section: { gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  designRow: { flexDirection: 'row', gap: spacing.xs },
  designItem: { flex: 1, alignItems: 'center', gap: 4 },
  designSwatch: {
    width: '100%',
    height: 64,
    borderRadius: radii.md,
    borderWidth: 2,
    borderBottomWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  designSwatchActive: { transform: [{ translateY: -2 }] },
  designLabel: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
  designLabelActive: { color: colors.text },
  recipientRow: { gap: spacing.xs, paddingRight: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  messageInput: { minHeight: 96, textAlignVertical: 'top' },
  pressed: { opacity: 0.9 },
});
