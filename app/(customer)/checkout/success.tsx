import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Money } from '@/src/components/Money';
import { Screen } from '@/src/components/Screen';
import { useGiftDraft } from '@/src/lib/gift-draft';
import { formatMoney } from '@/src/lib/money';
import { useThemeRefresh } from '@/src/lib/theme';
import { isUsablePhone, shareOnWhatsapp } from '@/src/lib/whatsapp';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '@/src/theme';
import { Glyph } from '@/src/components/Glyph';

export default function CheckoutSuccessScreen() {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  const { draft, reset } = useGiftDraft();
  const scheduled = Boolean(draft.deliveryDate);
  const [whatsappState, setWhatsappState] = useState<'idle' | 'sent' | 'error'>('idle');

  const lang = i18n.language === 'ar' ? 'ar' : 'en';
  const wantsWhatsapp = draft.deliveryMethod === 'whatsapp';
  const whatsappPhone = draft.recipient?.phone ?? '';
  const canWhatsapp = wantsWhatsapp && isUsablePhone(whatsappPhone);

  async function sendOnWhatsapp() {
    const opened = await shareOnWhatsapp(
      whatsappPhone,
      t('checkout.whatsappMessage', {
        name: draft.recipient?.name ?? '',
        amount: formatMoney(draft.amountMinor, lang),
      }),
    );
    setWhatsappState(opened ? 'sent' : 'error');
  }

  function finish(destination: '/(customer)/(tabs)/gifts' | '/(customer)/(tabs)') {
    reset();
    router.replace(destination);
  }

  return (
    <Screen scroll={false} contentStyle={styles.content}>
      <View style={styles.center}>
        <View style={styles.blob} />
        <View style={styles.circle}>
          <Glyph name="congratulations" size={44} />
        </View>
        <Text style={styles.title}>
          {scheduled ? t('checkout.scheduledTitle') : t('checkout.successTitle')}
        </Text>
        <Text style={styles.body}>
          {scheduled && draft.deliveryDate
            ? t('checkout.scheduledBody', {
                date: new Date(draft.deliveryDate).toLocaleDateString(
                  i18n.language === 'ar' ? 'ar-QA' : 'en-QA',
                ),
              })
            : wantsWhatsapp
              ? t('checkout.whatsappSuccessBody', {
                  name: draft.recipient?.name ?? t('send.recipientTitle'),
                })
              : t('checkout.successBody', { name: draft.recipient?.name ?? t('send.recipientTitle') })}
        </Text>

        <Card style={styles.receipt}>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>{t('checkout.total')}</Text>
            <Money minor={draft.amountMinor} style={styles.receiptValue} />
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>{t('send.recipientTitle')}</Text>
            <Text style={styles.receiptText}>{draft.recipient?.name ?? '—'}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>{t('checkout.paymentTitle')}</Text>
            <Text style={styles.receiptText}>{t('orders.paid')}</Text>
          </View>
        </Card>
      </View>

      <View style={styles.footer}>
        {wantsWhatsapp ? (
          <>
            <Button
              label={t('checkout.sendWhatsappCta')}
              onPress={sendOnWhatsapp}
              disabled={!canWhatsapp}
            />
            {whatsappState === 'sent' ? (
              <Text style={styles.whatsappOk}>{t('checkout.whatsappOpened')}</Text>
            ) : whatsappState === 'error' ? (
              <Text style={styles.whatsappBad}>{t('checkout.whatsappError')}</Text>
            ) : !canWhatsapp ? (
              <Text style={styles.whatsappBad}>{t('checkout.whatsappNoPhone')}</Text>
            ) : null}
          </>
        ) : null}
        <Button
          label={t('checkout.viewGift')}
          variant={wantsWhatsapp ? 'secondary' : 'primary'}
          onPress={() => finish('/(customer)/(tabs)/gifts')}
        />
        <Button
          label={t('checkout.backHome')}
          variant="secondary"
          onPress={() => finish('/(customer)/(tabs)')}
        />
      </View>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  content: { flex: 1, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  blob: {
    position: 'absolute',
    top: '22%',
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: colors.lavenderTint,
  },
  circle: {
    width: 150,
    height: 150,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.tealTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xxl,
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  receipt: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.md },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  receiptLabel: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted },
  receiptText: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.text },
  receiptValue: { fontSize: fontSizes.md, color: colors.text },
  whatsappOk: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.xs,
    color: colors.success,
    textAlign: 'center',
  },
  whatsappBad: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.xs,
    color: colors.danger,
    textAlign: 'center',
  },
  footer: { gap: spacing.sm },
}));
