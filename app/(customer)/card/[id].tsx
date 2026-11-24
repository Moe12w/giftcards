import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Glyph } from '@/src/components/Glyph';
import { Money } from '@/src/components/Money';
import { QRCode } from '@/src/components/QRCode';
import { Screen } from '@/src/components/Screen';
import { SessionMeter } from '@/src/components/SessionMeter';
import { GiftSkeleton } from '@/src/components/Skeleton';
import { useCards, useWalletRealtime } from '@/src/lib/cards';
import { isGiftWaiting } from '@/src/lib/delivery';
import { formatDate } from '@/src/lib/time';
import { useThemeRefresh } from '@/src/lib/theme';
import { formatMoney } from '@/src/lib/money';
import { isSessionCard } from '@/src/lib/sessions';
import type { GiftCard } from '@/src/lib/types';
import { fetchWalletPassLinks, syncWalletPass } from '@/src/lib/wallet-pass';
import { CARD_STATUS_TONE } from '@/src/lib/status';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';

export default function CardDetailScreen() {
  useThemeRefresh();
  useWalletRealtime();
  const { t, i18n } = useTranslation();
  const { id, name: paramName } = useLocalSearchParams<{ id: string; name?: string }>();
  const { ready, getCard, sentCards, sessionsLeft, valueLeft, canRedeem, revealPartnerCode, markPartnerCodeUsed, reload } =
    useCards();
  // Seeded from the wallet on first render; the realtime effect and the
  // partner-code flow keep it fresh afterwards.
  const [card, setCard] = useState<GiftCard | null>(() => (id ? getCard(id) : null));
  const previousCard = useRef<{ balance: number; sessions: number; status: string } | null>(null);
  const reacted = useRef(false);
  const [partnerCode, setPartnerCode] = useState<string | null>(null);
  const [codeError, setCodeError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [walletBusy, setWalletBusy] = useState<'apple' | 'google' | null>(null);

  // The vendor scans the QR on another device. Realtime reloads this card, so
  // a drop in balance/sessions means the scan just completed.
  useEffect(() => {
    if (!card) return;
    const snapshot = {
      balance: valueLeft(card),
      sessions: sessionsLeft(card),
      status: card.status,
    };
    const previous = previousCard.current;
    previousCard.current = snapshot;
    if (!previous || reacted.current) return;

    const spent =
      snapshot.balance < previous.balance || snapshot.sessions < previous.sessions;
    const completed = snapshot.status === 'redeemed' && previous.status !== 'redeemed';
    if (!spent && !completed) return;

    reacted.current = true;
    // The balance just moved: keep a saved Google Wallet pass in step.
    void syncWalletPass(card.id);
    Alert.alert(
      t('cards.scannedTitle'),
      t('cards.scannedBody'),
      [{ text: t('common.ok'), onPress: () => router.replace('/(customer)/(tabs)/gifts') }],
      { cancelable: false },
    );
  }, [card, sessionsLeft, valueLeft, t]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const cardName =
    card?.partner_name ?? card?.vendor_name ?? card?.offer_title ?? paramName ?? t('cards.details');

  const isPartnerCode = card?.fulfilment_type === 'enterprise_code';

  async function showPartnerCode() {
    if (!card) return;
    setCodeError(false);
    const code = await revealPartnerCode(card.id);
    if (code) {
      setPartnerCode(code);
      return;
    }
    setCodeError(true);
  }

  async function addToWallet(provider: 'apple' | 'google') {
    if (!card) return;
    setWalletBusy(provider);
    const links = await fetchWalletPassLinks(card.id);
    setWalletBusy(null);
    const url = links?.[provider] ?? null;
    if (!url) {
      Alert.alert(t('cards.walletTitle'), t('cards.walletNotConfigured'));
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('cards.walletTitle'), t('cards.walletNotConfigured'));
    }
  }

  async function markUsed() {
    if (!card) return;
    setBusy(true);
    const done = await markPartnerCodeUsed(card.id);
    setBusy(false);
    if (done) {
      setCard(getCard(card.id));
    } else {
      Alert.alert(t('common.errorGeneric'));
    }
  }

  const lang = i18n.language === 'ar' ? 'ar' : 'en';

  const sessionCard = useMemo(() => (card ? isSessionCard(card) : false), [card]);
  const isSent = Boolean(card && sentCards.some((item) => item.id === card.id));
  const remaining = card ? sessionsLeft(card) : 0;
  const balance = card ? valueLeft(card) : 0;
  // A gift bought for a future date is in the wallet but must not be spendable yet.
  const waiting = card ? isGiftWaiting(card) : false;
  const redeemable = card && !waiting ? canRedeem(card) : false;
  const redeemValue = `giftly:card:${card?.id ?? ''}`;
  // A partner code is shown at the partner's store, so it gets no
  // "scanned in person" note; the product's own instructions still show.
  const showRedemption =
    !isSent && (!isPartnerCode || Boolean(card?.redemption_instructions || card?.terms_and_conditions));

  if (!ready) {
    return (
      <Screen>
        <FlowHeader title={cardName} onBack={() => router.back()} />
        <GiftSkeleton />
      </Screen>
    );
  }

  if (!card) {
    return (
      <Screen>
        <FlowHeader title={cardName} onBack={() => router.back()} />
        <Text style={styles.title}>{t('common.errorGeneric')}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlowHeader title={cardName} onBack={() => router.back()} />

      <Card style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.vendor}>{card.partner_name ?? card.vendor_name ?? card.offer_title ?? 'Gift card'}</Text>
          {isSent ? (
            <Badge label={t('gifts.sent')} tone="primary" />
          ) : waiting ? (
            <Badge label={t('cards.scheduled')} tone="warning" />
          ) : (
            <Badge label={t(`cards.${card.status}`)} tone={CARD_STATUS_TONE[card.status]} />
          )}
        </View>

        {isSent ? (
          <>
            <Text style={styles.balanceLabel}>{t('cards.sentTitle')}</Text>
            <Text style={styles.qrHint}>
              {t('cards.sentHint', {
                name: card.recipient_name || card.recipient_email || t('gifts.sent'),
              })}
            </Text>
          </>
        ) : sessionCard ? (
          <>
            <Text style={styles.balanceLabel}>{t('sessions.remaining')}</Text>
            <Text style={styles.sessionCount}>
              {t('sessions.leftOf', {
                // Strings keep the digits Latin even where Intl is ignored.
                remaining: String(remaining),
                total: String(card.total_sessions ?? 1),
              })}
            </Text>
            <SessionMeter
              remaining={remaining}
              total={card.total_sessions ?? 1}
              tone={card.tone ?? 'teal'}
            />
          </>
        ) : (
          <>
            <Text style={styles.balanceLabel}>{t('cards.balance')}</Text>
            <Money minor={balance} style={styles.balance} />
          </>
        )}

        <Text style={styles.expiry}>
          {card.expires_at
            ? t('cards.expires', { date: formatDate(card.expires_at, lang) })
            : t('cards.noExpiry')}
        </Text>
      </Card>

      {waiting ? (
        <Card tone="sky" style={styles.qrCard}>
          <Glyph name="clock" size={18} />
          <Text style={styles.qrTitle}>{t('cards.scheduledTitle')}</Text>
          <Text style={styles.qrHint}>
            {card.scheduled_for
              ? t('cards.scheduledBody', { date: formatDate(card.scheduled_for, lang) })
              : t('cards.scheduledSoon')}
          </Text>
        </Card>
      ) : isPartnerCode ? (
        <Card style={styles.qrCard}>
          <Text style={styles.qrTitle}>{t('cards.partnerCodeTitle')}</Text>
          {partnerCode ? (
            <>
              {/* Partner gifts carry the partner's own code, so their till
                  scans this QR directly. It is not a Tazilla redemption QR. */}
              <QRCode value={partnerCode} />
              <Text style={styles.qrHint}>
                {t('cards.partnerQrHint', { partner: card?.partner_name ?? 'the partner' })}
              </Text>
              <Text style={styles.partnerCode} selectable>
                {partnerCode}
              </Text>
            </>
          ) : (
            <Text style={styles.qrHint}>
              {t('cards.partnerCodeHint', { partner: card?.partner_name ?? 'the partner' })}
            </Text>
          )}
          {card?.status === 'redeemed' ? (
            <Text style={styles.qrHint}>{t('cards.partnerCodeClosed')}</Text>
          ) : null}
          {codeError ? <Text style={styles.qrHint}>{t('cards.partnerCodeMissing')}</Text> : null}
          {card?.status !== 'redeemed' && !isSent ? (
            <View style={styles.partnerActions}>
              {!partnerCode ? (
                <Button label={t('cards.partnerCodeShow')} onPress={showPartnerCode} />
              ) : null}
              <Button
                label={t('cards.partnerCodeUsed')}
                variant="secondary"
                onPress={markUsed}
                disabled={busy}
              />
            </View>
          ) : null}
          {isSent ? <Text style={styles.qrHint}>{t('gifts.sent')}</Text> : null}
        </Card>
      ) : redeemable ? (
        <Card style={styles.qrCard}>
          <Text style={styles.qrTitle}>{t('cards.showCode')}</Text>
          <QRCode value={redeemValue} />
          {card.voucher_code ? (
            <Text style={styles.voucherCode} selectable>
              {card.voucher_code}
            </Text>
          ) : null}
          <Text style={styles.qrHint}>
            {sessionCard ? t('sessions.scanHint') : t('cards.scanHint')}
          </Text>
          <View style={styles.walletActions}>
            {Platform.OS === 'ios' ? (
              <Button
                label={t('cards.appleWallet')}
                variant="secondary"
                onPress={() => addToWallet('apple')}
                disabled={walletBusy !== null}
              />
            ) : null}
            <Button
              label={t('cards.googleWallet')}
              variant="secondary"
              onPress={() => addToWallet('google')}
              disabled={walletBusy !== null}
            />
          </View>
        </Card>
      ) : null}

      {showRedemption ? (
        <Card style={styles.redeemCard}>
          {isPartnerCode ? null : (
            <>
              <Text style={styles.qrTitle}>{t('cards.inPersonTitle')}</Text>
              <Text style={styles.redeemBody}>
                {t('cards.inPersonBody', {
                  vendor: card.partner_name ?? card.vendor_name ?? card.offer_title ?? 'the business',
                })}
              </Text>
            </>
          )}
          {card.redemption_instructions ? (
            <>
              <Text style={styles.redeemLabel}>{t('cards.redemptionTitle')}</Text>
              <Text style={styles.redeemBody}>{card.redemption_instructions}</Text>
            </>
          ) : null}
          {card.terms_and_conditions ? (
            <>
              <Text style={styles.redeemLabel}>{t('cards.termsTitle')}</Text>
              <Text style={styles.redeemBody}>{card.terms_and_conditions}</Text>
            </>
          ) : null}
        </Card>
      ) : null}

      <Card style={styles.infoCard}>
        <Row
          label={sessionCard ? t('sessions.packagePrice') : t('cards.originalValue')}
          value={formatMoney(card.original_value_minor, lang)}
        />
        {sessionCard ? (
          <Row
            label={t('sessions.included')}
            value={t('sessions.sessionCount', { count: card.total_sessions ?? 1 })}
          />
        ) : null}
        {card.recipient_name ? <Row label={t('offer.recipientName')} value={card.recipient_name} /> : null}
      </Card>

      {sessionCard ? (
        <Card tone="teal" style={styles.howCard}>
          <Glyph name="ticket" size={18} />
          <Text style={styles.howText}>{t('sessions.howItWorks')}</Text>
        </Card>
      ) : null}

      {isSent ? null : (
        <Text style={styles.privacy}>{sessionCard ? t('sessions.privacy') : t('cards.codeOnce')}</Text>
      )}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  loader: { marginTop: spacing.xxl },
  title: { fontSize: fontSizes.xxl, fontWeight: '700', color: colors.text },
  hero: { gap: spacing.xs, alignItems: 'center' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', alignSelf: 'stretch' },
  vendor: { fontSize: fontSizes.md, fontWeight: '700', color: colors.text, flex: 1 },
  balanceLabel: { fontSize: fontSizes.sm, color: colors.textMuted, marginTop: spacing.md },
  balance: { fontSize: 44, fontWeight: '800', color: colors.primaryDark },
  sessionCount: {
    fontFamily: fonts.extrabold,
    fontSize: 40,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  expiry: { fontSize: fontSizes.sm, color: colors.textMuted, marginTop: spacing.xs },
  qrCard: { alignItems: 'center', gap: spacing.sm },
  qrTitle: { fontSize: fontSizes.md, fontWeight: '700', color: colors.text },
  qrHint: { fontSize: fontSizes.sm, color: colors.textMuted, textAlign: 'center' },
  voucherCode: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.md,
    letterSpacing: 2,
    color: colors.text,
    marginTop: spacing.xs,
  },
  infoCard: { gap: spacing.sm },
  redeemCard: { gap: spacing.xs },
  redeemLabel: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.xs,
  },
  redeemBody: { fontSize: fontSizes.sm, color: colors.textMuted, lineHeight: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { fontSize: fontSizes.md, color: colors.textMuted },
  rowValue: { fontSize: fontSizes.md, color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  howCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  howText: { flex: 1, fontSize: fontSizes.sm, color: colors.text, lineHeight: 19 },
  privacy: { fontSize: fontSizes.xs, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
  partnerCode: {
    fontSize: fontSizes.xl,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 2,
    textAlign: 'center',
    marginVertical: spacing.sm,
  },
  walletActions: {
    alignSelf: 'stretch',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  partnerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
}));
