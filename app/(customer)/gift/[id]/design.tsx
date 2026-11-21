import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Chip } from '@/src/components/Chip';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Glyph } from '@/src/components/Glyph';
import { GuestGate } from '@/src/components/GuestGate';
import { GiftCardVisual } from '@/src/components/GiftCardVisual';
import { Money } from '@/src/components/Money';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { offerBusinessLogo, offerIcon, offerIsFixedAmount, offerPackages, offerTitle, offerTone } from '@/src/lib/catalog';
import { useAuth } from '@/src/lib/auth';
import { useThemeRefresh } from '@/src/lib/theme';
import { getOffer } from '@/src/lib/data';
import { useGiftDraft, type DeliveryMethod } from '@/src/lib/gift-draft';
import { isUsablePhone } from '@/src/lib/whatsapp';
import { formatMoney, toMinorUnits } from '@/src/lib/money';
import { useRecipients } from '@/src/lib/recipients';
import type { Offer, ProductVariant } from '@/src/lib/types';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '@/src/theme';

const DESIGNS = [
  { id: 'classic', background: colors.surface, edge: colors.ink, text: colors.ink, icon: 'gift' },
  { id: 'confetti', background: colors.pinkTint, edge: colors.pink, text: colors.ink, icon: 'congratulations' },
  { id: 'minimal', background: colors.tealTint, edge: colors.teal, text: colors.ink, icon: 'wellness' },
  { id: 'midnight', background: colors.plum, edge: colors.ink, text: colors.surface, icon: 'moon' },
] as const;

const DELIVERY_METHODS: DeliveryMethod[] = ['email', 'sms', 'whatsapp', 'link'];
const SUGGESTIONS = ['birthday', 'thankYou', 'congrats', 'justBecause'] as const;

/**
 * Draft recipient ids are minted when a recipient is chosen. Built outside the
 * component so rendering never reads the clock.
 */
function newRecipientId(): string {
  return `r_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export default function GiftComposeScreen() {
  useThemeRefresh();
  const { recipients } = useRecipients();
  const { user, loading: authLoading } = useAuth();
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { draft, update, ready } = useGiftDraft();
  const [offer, setOffer] = useState<Offer | null>(null);
  // No id means there is nothing to fetch: start settled rather than
  // flipping the flag from inside the effect.
  const [loading, setLoading] = useState(!id);

  // The typed custom amount belongs to one card; a different offer starts blank.
  const [customInput, setCustomInput] = useState<{ offerId: string; text: string } | null>(null);

  // Every field below mirrors the shared draft, which hydrates from AsyncStorage
  // after mount. Each holds only the user's own edit, so a draft that lands late
  // still fills whatever was left untouched instead of being written by an effect.
  const [nameEdit, setNameEdit] = useState<string | null>(null);
  const [emailEdit, setEmailEdit] = useState<string | null>(null);
  const [phoneEdit, setPhoneEdit] = useState<string | null>(null);
  const [messageEdit, setMessageEdit] = useState<string | null>(null);
  const [modeEdit, setModeEdit] = useState<'now' | 'schedule' | null>(null);
  const [dateEdit, setDateEdit] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const recipientName = nameEdit ?? draft.recipient?.name ?? '';
  const recipientEmail = emailEdit ?? draft.recipient?.email ?? '';
  const recipientPhone = phoneEdit ?? draft.recipient?.phone ?? '';
  const message = messageEdit ?? draft.message;
  const mode = modeEdit ?? (draft.deliveryDate ? 'schedule' : 'now');
  const dateText = dateEdit ?? (draft.deliveryDate ? draft.deliveryDate.slice(0, 10) : '');

  const lang = i18n.language === 'ar' ? 'ar' : 'en';

  useEffect(() => {
    let active = true;
    if (!id) return;
    getOffer(id)
      .then((data) => active && setOffer(data))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  // Starting from a different gift card resets the amount to that card's
  // suggested value while keeping the rest of the draft (recipient, message).
  // Experience gifts always start on the vendor's first package.
  //
  // This is an initialisation step, not a continuous reconciliation. The draft
  // is shared by every gift screen, so re-running this on every draft change
  // lets two mounted screens (or a Fast Refresh) overwrite each other forever.
  // Sync once per offer, after AsyncStorage has hydrated.
  const syncedOfferId = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !offer) return;
    if (syncedOfferId.current === offer.id) return;
    syncedOfferId.current = offer.id;
    if (offer.fulfilment_type === 'experience') {
      const packages = offerPackages(offer);
      const first = packages[0];
      if (!first) {
        if (draft.offerId !== offer.id || draft.variantId !== null || draft.amountMinor !== 0) {
          update({ offerId: offer.id, variantId: null, amountMinor: 0 });
        }
        return;
      }
      const current = packages.find((variant) => variant.id === draft.variantId);
      if (draft.offerId !== offer.id || !current) {
        update({
          offerId: offer.id,
          variantId: first.id,
          amountMinor: first.price_minor,
        });
      }
      return;
    }
    if (offerIsFixedAmount(offer)) {
      if (
        draft.offerId !== offer.id ||
        draft.amountMinor !== offer.min_amount_minor ||
        draft.variantId !== null
      ) {
        update({
          offerId: offer.id,
          variantId: null,
          amountMinor: offer.min_amount_minor,
        });
      }
      return;
    }
    if (draft.offerId !== offer.id || draft.amountMinor <= 0 || draft.variantId) {
      update({
        offerId: offer.id,
        variantId: null,
        amountMinor: offer.preset_amounts_minor[1] ?? offer.min_amount_minor,
      });
    }
  }, [draft.amountMinor, draft.offerId, draft.variantId, offer, ready, update]);

  if (authLoading) return null;
  if (!user) {
    return <GuestGate title={t('guest.giftTitle')} body={t('guest.giftBody')} showBrowse />;
  }

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

  const packages = offerPackages(offer);
  const isExperience = offer.fulfilment_type === 'experience';
  const isFixedAmount = offerIsFixedAmount(offer);
  const selectedPackage = packages.find((variant) => variant.id === draft.variantId) ?? packages[0] ?? null;
  const min = offer.min_amount_minor;
  const max = offer.max_amount_minor;
  const amount = isFixedAmount ? min : draft.amountMinor;
  const custom = customInput && customInput.offerId === offer.id ? customInput.text : '';

  function chooseAmount(minor: number) {
    update({ amountMinor: minor, variantId: null });
    setCustomInput(null);
    setErrors((prev) => ({ ...prev, amount: '' }));
  }

  function choosePackage(variant: ProductVariant) {
    update({ variantId: variant.id, amountMinor: variant.price_minor });
    setErrors((prev) => ({ ...prev, amount: '' }));
  }

  function onChangeCustom(text: string) {
    setCustomInput({ offerId: offer!.id, text });
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
    setNameEdit(name);
    setEmailEdit(email);
    setPhoneEdit(phone ?? '');
    update({
      recipient: {
        id: draft.recipient?.id ?? newRecipientId(),
        name,
        email,
        phone,
      },
    });
    setErrors((prev) => ({ ...prev, recipientName: '', recipientEmail: '' }));
  }

  function next() {
    const nextErrors: Record<string, string> = {};
    if (isExperience) {
      if (!selectedPackage) nextErrors.amount = t('gift.choosePackage');
    } else if (!isFixedAmount) {
      if (custom.trim()) {
        try {
          const parsed = toMinorUnits(custom);
          if (parsed < min || parsed > max) nextErrors.amount = t('offer.invalidAmount');
        } catch {
          nextErrors.amount = t('offer.invalidAmount');
        }
      }
      if (amount < min || amount > max) nextErrors.amount = t('offer.invalidAmount');
    }
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
      variantId: isExperience ? selectedPackage?.id ?? null : null,
      amountMinor: isExperience ? selectedPackage?.price_minor ?? 0 : amount,
      recipient: {
        id: draft.recipient?.id ?? newRecipientId(),
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
        logoUrl={offerBusinessLogo(offer)}
        tone={previewTone}
        amountMinor={isExperience ? undefined : amount}
        sessionsTotal={
          isExperience ? selectedPackage?.session_count ?? packages[0]?.session_count ?? undefined : undefined
        }
        sessionsRemaining={
          isExperience ? selectedPackage?.session_count ?? packages[0]?.session_count ?? undefined : undefined
        }
        message={message || undefined}
        meta={recipientName.trim() ? `${t('send.recipientTitle')}: ${recipientName.trim()}` : undefined}
      />

      {/* Price: vendor packages for experiences, presets/custom for money cards */}
      {isExperience ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('gift.packageTitle')}</Text>
          <Text style={styles.sectionHint}>{t('gift.packageSubtitle')}</Text>
          {packages.length === 0 ? (
            <Text style={styles.emptyPackages}>{t('gift.noPackages')}</Text>
          ) : (
            <View style={styles.packageList}>
              {packages.map((variant) => {
                const active = selectedPackage?.id === variant.id;
                return (
                  <Pressable
                    key={variant.id}
                    onPress={() => choosePackage(variant)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${variant.label} ${formatMoney(variant.price_minor, lang)}`}
                    style={({ pressed }) => [
                      styles.packageCard,
                      active && styles.packageCardActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.packageIcon}>
                      <Glyph name="ticket" size={20} />
                    </View>
                    <View style={styles.packageCopy}>
                      <Text style={styles.packageLabel} numberOfLines={1}>
                        {variant.label}
                      </Text>
                      <Text style={styles.packageMeta}>
                        {variant.session_count
                          ? t('sessions.sessionCount', { count: variant.session_count })
                          : t('gift.priceSetByVendor')}
                      </Text>
                    </View>
                    <Money minor={variant.price_minor} style={styles.packagePrice} />
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active ? <View style={styles.radioDot} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
          {errors.amount ? <Text style={styles.errorText}>{errors.amount}</Text> : null}
        </Card>
      ) : isFixedAmount ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('gift.fixedValue')}</Text>
          <View style={styles.fixedAmountRow}>
            <Money minor={min} style={styles.fixedAmountValue} />
          </View>
          <Text style={styles.sectionHint}>{t('gift.fixedValueHint')}</Text>
        </Card>
      ) : (
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
      )}

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
                      borderColor: colors.border,
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
            setNameEdit(value);
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
              setEmailEdit(value);
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
              setPhoneEdit(value);
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
                    : method === 'whatsapp'
                      ? t('send.deliveryWhatsapp')
                      : t('send.deliveryLink')
              }
              active={draft.deliveryMethod === method}
              onPress={() => update({ deliveryMethod: method })}
            />
          ))}
        </View>
        {draft.deliveryMethod === 'whatsapp' ? (
          <Text style={styles.deliveryHint}>{t('send.deliveryWhatsappBody')}</Text>
        ) : null}
        <View style={styles.chipRow}>
          <Chip
            label={t('send.deliveryNow')}
            active={mode === 'now'}
            onPress={() => {
              setModeEdit('now');
              setErrors((prev) => ({ ...prev, date: '' }));
            }}
          />
          <Chip
            label={t('send.deliverySchedule')}
            active={mode === 'schedule'}
            onPress={() => setModeEdit('schedule')}
          />
        </View>
        {mode === 'schedule' ? (
          <TextField
            label={t('send.deliveryDate')}
            value={dateText}
            onChangeText={(value) => {
              setDateEdit(value);
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
          onChangeText={setMessageEdit}
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
              onPress={() => setMessageEdit(t(`send.suggestions.${key}`))}
            />
          ))}
        </View>
      </Card>

      <Button
        label={t('gift.continueToPayment')}
        onPress={next}
        disabled={isExperience && packages.length === 0}
      />
    </Screen>
  );
}

const styles = themedStyles(() => ({
  loader: { marginTop: spacing.xxl },
  section: { gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  sectionHint: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 19,
  },
  packageList: { gap: spacing.xs },
  packageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  packageCardActive: { backgroundColor: colors.tealTint },
  packageIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packageCopy: { flex: 1, gap: 1 },
  packageLabel: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.text },
  packageMeta: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  packagePrice: { fontSize: fontSizes.md, color: colors.text },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { backgroundColor: colors.teal },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ink },
  emptyPackages: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 19,
  },
  errorText: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.danger },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fixedAmountRow: {
    borderRadius: radii.md,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.border,
    backgroundColor: colors.tealTint,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  fixedAmountValue: { fontSize: fontSizes.xl },
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
  deliveryHint: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    lineHeight: 17,
  },
  messageInput: { minHeight: 96, textAlignVertical: 'top' },
  pressed: { opacity: 0.9 },
}));
