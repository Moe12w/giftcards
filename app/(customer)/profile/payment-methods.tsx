import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { MOCK_PAYMENT_METHODS } from '@/src/lib/mock-data';
import { colors, fonts, fontSizes, radii, spacing } from '@/src/theme';

export default function PaymentMethodsScreen() {
  const { t } = useTranslation();
  const [methods, setMethods] = useState(MOCK_PAYMENT_METHODS);
  const [added, setAdded] = useState(false);

  function add() {
    setMethods((current) => [
      ...current,
      { id: `pm-${Date.now()}`, brand: 'Visa', last4: '0000', expiry: '12/30', isDefault: false },
    ]);
    setAdded(true);
  }

  return (
    <Screen>
      <FlowHeader title={t('profile.paymentMethods')} onBack={() => router.back()} />

      {added ? <Text style={styles.saved}>{t('profile.paymentAdded')}</Text> : null}

      {methods.length === 0 ? (
        <EmptyState
          title={t('profile.noPaymentMethods')}
          body={t('profile.addFirstCard')}
          icon="💳"
          tone="teal"
        />
      ) : (
        <View style={styles.list}>
          {methods.map((method) => (
            <Card key={method.id} style={styles.row}>
              <View style={styles.brand}>
                <Text style={styles.brandText}>{method.brand}</Text>
              </View>
              <View style={styles.copy}>
                <Text style={styles.title}>•••• {method.last4}</Text>
                <Text style={styles.meta}>{method.expiry}</Text>
              </View>
              {method.isDefault ? <Badge label={t('profile.default')} tone="success" /> : null}
              <Text
                onPress={() => setMethods((current) => current.filter((item) => item.id !== method.id))}
                style={styles.remove}
              >
                {t('profile.remove')}
              </Text>
            </Card>
          ))}
        </View>
      )}

      <Button label={t('profile.addPayment')} onPress={add} />
      <Button
        label={t('common.back')}
        variant="secondary"
        onPress={() => router.back()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  saved: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.success },
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brand: {
    width: 48,
    height: 34,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { fontFamily: fonts.extrabold, fontSize: fontSizes.xs, color: colors.ink },
  copy: { flex: 1, gap: 1 },
  title: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  remove: { fontFamily: fonts.bold, fontSize: fontSizes.xs, color: colors.danger },
});
