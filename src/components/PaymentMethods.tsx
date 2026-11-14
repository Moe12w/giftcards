// src/components/PaymentMethods.tsx
// Shared card/wallet picker used by single-gift checkout and group-basket
// contributions. The parent screen owns the actual "payment" action so both
// flows can decide what to do once the charge succeeds.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatMoney } from '../lib/money';
import { addPaymentMethod, listPaymentMethods } from '../lib/data';
import type { PaymentMethod } from '../lib/types';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '../theme';
import { Button } from './Button';
import { Card } from './Card';
import { TextField } from './TextField';

interface PaymentMethodsProps {
  amountMinor: number;
  onPay: () => void;
  payLabel?: string;
  paying?: boolean;
}

export function PaymentMethods({ amountMinor, onPay, payLabel, paying = false }: PaymentMethodsProps) {
  const { t, i18n } = useTranslation();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selected, setSelected] = useState('new');
  const [adding, setAdding] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const lang = i18n.language === 'ar' ? 'ar' : 'en';
  const amountLabel = formatMoney(amountMinor, lang);

  // The saved cards come from the database.
  useEffect(() => {
    let active = true;
    listPaymentMethods()
      .then((rows) => {
        if (!active) return;
        setMethods(rows);
        setSelected(rows[0]?.id ?? 'new');
        setAdding(rows.length === 0);
      })
      .catch(() => {
        if (!active) return;
        setMethods([]);
        setSelected('new');
        setAdding(true);
      });
    return () => {
      active = false;
    };
  }, []);

  function pay() {
    if (adding) {
      const next: Record<string, string> = {};
      if (cardNumber.replace(/\s/g, '').length < 12) next.number = t('common.required');
      if (!cardName.trim()) next.name = t('common.required');
      if (!/^\d{2}\/\d{2}$/.test(expiry)) next.expiry = t('common.required');
      if (cvc.length < 3) next.cvc = t('common.required');
      setErrors(next);
      if (Object.keys(next).length > 0) return;
    }
    onPay();
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.methods}>
        {methods.map((method) => {
          const active = selected === method.id && !adding;
          return (
            <Pressable
              key={method.id}
              onPress={() => {
                setSelected(method.id);
                setAdding(false);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Card tone={active ? 'teal' : 'surface'} style={styles.method}>
                <View style={styles.brand}>
                  <Text style={styles.brandText}>{method.brand}</Text>
                </View>
                <View style={styles.methodCopy}>
                  <Text style={styles.methodTitle}>•••• {method.last4}</Text>
                  <Text style={styles.methodMeta}>{method.expiry}</Text>
                </View>
                {method.isDefault ? (
                  <Text style={styles.defaultTag}>{t('profile.default')}</Text>
                ) : null}
                <View style={[styles.radio, active && styles.radioActive]} />
              </Card>
            </Pressable>
          );
        })}

        <Pressable
          onPress={() => setAdding(true)}
          accessibilityRole="button"
          accessibilityState={{ selected: adding }}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <Card tone={adding ? 'teal' : 'surface'} style={styles.method}>
            <View style={styles.brand}>
              <Text style={styles.brandText}>＋</Text>
            </View>
            <Text style={styles.methodTitle}>{t('checkout.newCard')}</Text>
            <View style={[styles.radio, adding && styles.radioActive]} />
          </Card>
        </Pressable>
      </View>

      {adding ? (
        <Card style={styles.form}>
          <TextField
            label={t('checkout.cardNumber')}
            value={cardNumber}
            onChangeText={setCardNumber}
            keyboardType="number-pad"
            placeholder="4242 4242 4242 4242"
            error={errors.number}
          />
          <TextField
            label={t('checkout.cardName')}
            value={cardName}
            onChangeText={setCardName}
            autoCapitalize="words"
            error={errors.name}
          />
          <View style={styles.formRow}>
            <View style={styles.formHalf}>
              <TextField
                label={t('checkout.cardExpiry')}
                value={expiry}
                onChangeText={setExpiry}
                placeholder="MM/YY"
                keyboardType="number-pad"
                error={errors.expiry}
              />
            </View>
            <View style={styles.formHalf}>
              <TextField
                label={t('checkout.cardCvc')}
                value={cvc}
                onChangeText={setCvc}
                placeholder="123"
                keyboardType="number-pad"
                maxLength={4}
                error={errors.cvc}
              />
            </View>
          </View>
        </Card>
      ) : null}

      <Button
        label={payLabel ?? t('checkout.pay', { amount: amountLabel })}
        onPress={pay}
        loading={paying}
      />
      <View style={styles.walletRow}>
        <Button
          label={t('checkout.applePay')}
          variant="secondary"
          style={styles.walletButton}
          onPress={onPay}
          disabled={paying}
        />
        <Button
          label={t('checkout.googlePay')}
          variant="secondary"
          style={styles.walletButton}
          onPress={onPay}
          disabled={paying}
        />
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  wrapper: { gap: spacing.sm },
  methods: { gap: spacing.sm },
  method: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brand: {
    width: 46,
    height: 34,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { fontFamily: fonts.extrabold, fontSize: fontSizes.xs, color: colors.ink },
  methodCopy: { flex: 1, gap: 1 },
  methodTitle: { flex: 1, fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.text },
  methodMeta: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  defaultTag: { fontFamily: fonts.bold, fontSize: fontSizes.xs, color: colors.tealDark },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
  },
  radioActive: { backgroundColor: colors.plum },
  form: { gap: spacing.sm },
  formRow: { flexDirection: 'row', gap: spacing.sm },
  formHalf: { flex: 1 },
  walletRow: { flexDirection: 'row', gap: spacing.sm },
  walletButton: { flex: 1 },
  pressed: { opacity: 0.9 },
}));
