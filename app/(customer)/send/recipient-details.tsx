import React, { useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { useGiftDraft } from '@/src/lib/gift-draft';

export default function RecipientDetailsScreen() {
  const { t } = useTranslation();
  const { draft, update } = useGiftDraft();
  const [name, setName] = useState(draft.recipient?.name ?? '');
  const [email, setEmail] = useState(draft.recipient?.email ?? '');
  const [phone, setPhone] = useState(draft.recipient?.phone ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function save() {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t('common.required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = t('auth.invalidEmail');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    update({
      recipient: {
        id: draft.recipient?.id ?? `recipient-${Date.now()}`,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
      },
    });
    router.push('/(customer)/send/delivery');
  }

  return (
    <Screen>
      <FlowHeader
        title={t('send.recipientDetailsTitle')}
        step={0}
        total={4}
        onBack={() => router.back()}
      />

      <TextField
        label={t('send.recipientName')}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        error={errors.name}
      />
      <TextField
        label={t('send.recipientEmail')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        error={errors.email}
      />
      <TextField
        label={t('send.recipientPhone')}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />

      <Button label={t('send.saveRecipient')} onPress={save} />
    </Screen>
  );
}
