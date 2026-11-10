import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

interface Address {
  id: string;
  label: string;
  line: string;
  city: string;
  zip: string;
}

export default function AddressesScreen() {
  const { t } = useTranslation();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [line, setLine] = useState('');
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');

  function save() {
    if (!line.trim()) return;
    setAddresses((current) => [
      ...current,
      { id: `address-${Date.now()}`, label: label || t('profile.addresses'), line, city, zip },
    ]);
    setAdding(false);
    setLabel('');
    setLine('');
    setCity('');
    setZip('');
  }

  return (
    <Screen>
      <FlowHeader title={t('profile.addresses')} onBack={() => router.back()} />

      {addresses.length === 0 && !adding ? (
        <EmptyState
          title={t('profile.noAddresses')}
          body={t('profile.addAddress')}
          icon="📍"
          tone="teal"
        />
      ) : (
        <View style={styles.list}>
          {addresses.map((address) => (
            <Card key={address.id} style={styles.card}>
              <Text style={styles.label}>{address.label}</Text>
              <Text style={styles.line}>{address.line}</Text>
              <Text style={styles.meta}>
                {address.city} {address.zip}
              </Text>
            </Card>
          ))}
        </View>
      )}

      {adding ? (
        <Card style={styles.form}>
          <TextField label={t('profile.addressLabel')} value={label} onChangeText={setLabel} />
          <TextField label={t('profile.addressLine')} value={line} onChangeText={setLine} />
          <TextField label={t('profile.city')} value={city} onChangeText={setCity} />
          <TextField label={t('profile.zip')} value={zip} onChangeText={setZip} keyboardType="number-pad" />
          <Button label={t('common.save')} onPress={save} />
        </Card>
      ) : (
        <Button label={t('profile.addAddress')} onPress={() => setAdding(true)} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  card: { gap: 2 },
  label: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  line: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  form: { gap: spacing.sm },
});
