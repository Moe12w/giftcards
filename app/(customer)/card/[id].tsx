import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Badge, type BadgeTone } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Glyph } from '@/src/components/Glyph';
import { Money } from '@/src/components/Money';
import { QRCode } from '@/src/components/QRCode';
import { Screen } from '@/src/components/Screen';
import { SessionMeter } from '@/src/components/SessionMeter';
import { useCards } from '@/src/lib/cards';
import { formatMoney } from '@/src/lib/money';
import { isSessionCard } from '@/src/lib/sessions';
import type { CardStatus, GiftCard } from '@/src/lib/types';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

const statusTone: Record<CardStatus, BadgeTone> = {
  issued: 'warning',
  claimed: 'success',
  redeemed: 'neutral',
  expired: 'danger',
  voided: 'danger',
};

export default function CardDetailScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ready, getCard, sessionsLeft, valueLeft, canRedeem, revealPartnerCode, markPartnerCodeUsed } =
    useCards();
  const [card, setCard] = useState<GiftCard | null>(null);
  const [partnerCode, setPartnerCode] = useState<string | null>(null);
  const [codeError, setCodeError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    setCard(getCard(id));
  }, [getCard, id]);

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
  const remaining = card ? sessionsLeft(card) : 0;
  const balance = card ? valueLeft(card) : 0;
  const redeemable = card ? canRedeem(card) : false;
  const redeemValue = `giftly:card:${card?.id ?? ''}`;

  function walletUnavailable() {
    Alert.alert(t('cards.addToWallet'), t('cards.walletNotConfigured'));
  }

  if (!ready) {
    return (
      <Screen>
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      </Screen>
    );
  }

  if (!card) {
    return (
      <Screen>
        <FlowHeader title={t('cards.details')} onBack={() => router.back()} />
        <Text style={styles.title}>{t('common.errorGeneric')}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlowHeader title={t('cards.details')} onBack={() => router.back()} />

      <Card style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.vendor}>{card.vendor_name ?? card.offer_title ?? 'Gift card'}</Text>
          <Badge label={t(`cards.${card.status}`)} tone={statusTone[card.status]} />
        </View>

        {sessionCard ? (
          <>
            <Text style={styles.balanceLabel}>{t('sessions.remaining')}</Text>
            <Text style={styles.sessionCount}>
              {t('sessions.leftOf', { remaining, total: card.total_sessions ?? 1 })}
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
            ? t('cards.expires', {
                date: new Date(card.expires_at).toLocaleDateString(lang === 'ar' ? 'ar-QA' : 'en-QA'),
              })
            : t('cards.noExpiry')}
        </Text>
      </Card>

      {isPartnerCode ? (
        <Card style={styles.qrCard}>
          <Text style={styles.qrTitle}>{t('cards.partnerCodeTitle')}</Text>
          {partnerCode ? (
            <Text style={styles.partnerCode} selectable>
              {partnerCode}
            </Text>
          ) : (
            <Text style={styles.qrHint}>
              {t('cards.partnerCodeHint', { partner: card?.partner_name ?? 'the partner' })}
            </Text>
          )}
          {card?.status === 'redeemed' ? (
            <Text style={styles.qrHint}>{t('cards.partnerCodeClosed')}</Text>
          ) : null}
          {codeError ? <Text style={styles.qrHint}>{t('cards.partnerCodeMissing')}</Text> : null}
          {card?.status !== 'redeemed' ? (
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
        </Card>
      ) : redeemable ? (
        <Card style={styles.qrCard}>
          <Text style={styles.qrTitle}>{t('cards.showCode')}</Text>
          <QRCode value={redeemValue} />
          <Text style={styles.qrHint}>
            {sessionCard ? t('sessions.scanHint') : t('cards.scanHint')}
          </Text>
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

      <Button label={t('cards.appleWallet')} variant="secondary" onPress={walletUnavailable} />
      <Button label={t('cards.googleWallet')} variant="secondary" onPress={walletUnavailable} />

      <Text style={styles.privacy}>{sessionCard ? t('sessions.privacy') : t('cards.codeOnce')}</Text>
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

const styles = StyleSheet.create({
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
  infoCard: { gap: spacing.sm },
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
  partnerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
});
