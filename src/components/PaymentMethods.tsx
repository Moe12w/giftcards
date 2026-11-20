// src/components/PaymentMethods.tsx
// Giftly never handles card data. The customer is sent to MyFatoorah's hosted
// page, which offers whatever the business has enabled (card, Apple Pay,
// Google Pay). The parent screen owns the actual payment action.
import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatMoney } from '../lib/money';
import { colors, fonts, fontSizes, spacing, themedStyles } from '../theme';
import { Button } from './Button';
import { Card } from './Card';

interface PaymentMethodsProps {
  amountMinor: number;
  onPay: () => void;
  payLabel?: string;
  paying?: boolean;
}

export function PaymentMethods({ amountMinor, onPay, payLabel, paying = false }: PaymentMethodsProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'ar' ? 'ar' : 'en';
  const amountLabel = formatMoney(amountMinor, lang);

  return (
    <View style={styles.wrapper}>
      <Card style={styles.note}>
        <Text style={styles.noteText}>{t('checkout.securePaymentNote')}</Text>
      </Card>
      <Button
        label={payLabel ?? t('checkout.pay', { amount: amountLabel })}
        onPress={onPay}
        loading={paying}
      />
    </View>
  );
}

const styles = themedStyles(() => ({
  wrapper: { gap: spacing.sm },
  note: { gap: spacing.xs },
  noteText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 19,
  },
}));
