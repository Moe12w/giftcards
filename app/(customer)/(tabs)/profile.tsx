import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/src/components/Avatar';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { ListRow } from '@/src/components/ListRow';
import { PageHeader } from '@/src/components/PageHeader';
import { Screen } from '@/src/components/Screen';
import { useAuth } from '@/src/lib/auth';
import { useThemeRefresh } from '@/src/lib/theme';
import { listMyCards, listMyOrders } from '@/src/lib/data';
import { setLanguage, type Language } from '@/src/i18n';
import type { GiftCard, Order } from '@/src/lib/types';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';

export default function ProfileScreen() {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  const { user, signOut, isDemo } = useAuth();
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([listMyCards(), listMyOrders()])
      .then(([cardData, orderData]) => {
        if (!active) return;
        setCards(cardData);
        setOrders(orderData);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const name = (user?.user_metadata?.full_name as string | undefined) ?? t('common.appName');
  const email = user?.email ?? t('auth.demoHint');

  const activeCards = useMemo(
    () => cards.filter((card) => card.status === 'claimed' || card.status === 'issued').length,
    [cards],
  );

  async function changeLanguage(lang: Language) {
    await setLanguage(lang);
    if (Platform.OS !== 'web' && lang === 'ar') {
      Alert.alert(t('common.done'), t('account.rtlReloadHint'));
    }
  }

  function confirmSignOut() {
    Alert.alert(t('profile.logoutTitle'), t('profile.logoutBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.logout'),
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  return (
    <Screen tabbed>
      <PageHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />

      <Card tone="pink" style={styles.identity}>
        <View style={styles.identityRow}>
          <Avatar name={name} size={68} tone="lavender" />
          <View style={styles.identityCopy}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {email}
            </Text>
            {isDemo ? <Text style={styles.demo}>{t('auth.demoHint')}</Text> : null}
          </View>
        </View>
        <Button
          label={t('profile.editProfile')}
          variant="secondary"
          onPress={() => router.push('/(customer)/profile/edit')}
        />
      </Card>

      <View style={styles.statsRow}>
        <Card tone="teal" style={styles.statCard}>
          <Text style={styles.statValue}>{cards.length}</Text>
          <Text style={styles.statLabel}>{t('gifts.sent')}</Text>
        </Card>
        <Card tone="lavender" style={styles.statCard}>
          <Text style={styles.statValue}>{activeCards}</Text>
          <Text style={styles.statLabel}>{t('gifts.active')}</Text>
        </Card>
        <Card tone="gold" style={styles.statCard}>
          <Text style={styles.statValue}>{orders.length}</Text>
          <Text style={styles.statLabel}>{t('orders.title')}</Text>
        </Card>
      </View>

      <Card>
        <ListRow
          icon="user"
          tone="teal"
          title={t('profile.personalInfo')}
          onPress={() => router.push('/(customer)/profile/personal')}
        />
        <ListRow
          icon="creditCard"
          tone="pink"
          title={t('profile.paymentMethods')}
          onPress={() => router.push('/(customer)/profile/payment-methods')}
        />
        <ListRow
          icon="store"
          tone="gold"
          title={t('profile.favourites')}
          onPress={() => router.push('/(customer)/profile/favourites')}
        />
        <ListRow
          icon="users"
          tone="lavender"
          title={t('profile.recipients')}
          onPress={() => router.push('/(customer)/profile/recipients')}
        />
        <ListRow
          icon="location"
          tone="teal"
          title={t('profile.addresses')}
          last
          onPress={() => router.push('/(customer)/profile/addresses')}
        />
      </Card>

      <Card>
        <ListRow
          icon="globe"
          tone="lavender"
          title={t('profile.language')}
          value={i18n.language === 'ar' ? t('account.arabic') : t('account.english')}
          onPress={() => router.push('/(customer)/profile/language')}
        />
        <ListRow
          icon="settings"
          tone="teal"
          title={t('profile.preferences')}
          onPress={() => router.push('/(customer)/profile/preferences')}
        />
        <ListRow
          icon="settings"
          tone="pink"
          title={t('profile.notifications')}
          onPress={() => router.push('/(customer)/notifications/preferences')}
        />
        <ListRow
          icon="bell"
          tone="gold"
          title={t('profile.security')}
          onPress={() => router.push('/(customer)/profile/security')}
        />
        <ListRow
          icon="lock"
          tone="teal"
          title={t('profile.privacy')}
          last
          onPress={() => router.push('/(customer)/profile/privacy')}
        />
      </Card>

      <Card>
        <ListRow
          icon="shield"
          tone="teal"
          title={t('profile.support')}
          onPress={() => router.push('/(customer)/support')}
        />
        <ListRow
          icon="justBecause"
          tone="lavender"
          title={t('profile.about')}
          onPress={() => router.push('/(customer)/info/about')}
        />
        <ListRow
          icon="message"
          tone="gold"
          title={t('profile.version')}
          value="1.0.0"
          last
          onPress={() => router.push('/(customer)/info/version')}
        />
      </Card>

      <View style={styles.languageRow}>
        <Button
          label={t('account.english')}
          variant={i18n.language === 'ar' ? 'secondary' : 'primary'}
          fullWidth={false}
          style={styles.languageButton}
          onPress={() => changeLanguage('en')}
        />
        <Button
          label={t('account.arabic')}
          variant={i18n.language === 'ar' ? 'primary' : 'secondary'}
          fullWidth={false}
          style={styles.languageButton}
          onPress={() => changeLanguage('ar')}
        />
      </View>

      <Button label={t('profile.logout')} variant="secondary" onPress={confirmSignOut} />
      <Button
        label={t('profile.deleteAccount')}
        variant="danger"
        onPress={() => router.push('/(customer)/profile/delete')}
      />
    </Screen>
  );
}

const styles = themedStyles(() => ({
  identity: { gap: spacing.md },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  identityCopy: { flex: 1, gap: 2 },
  name: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xl,
    color: colors.text,
  },
  email: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  demo: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: { flex: 1, alignItems: 'center', gap: 1, paddingVertical: spacing.sm + 2 },
  statValue: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xl,
    color: colors.text,
  },
  statLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  languageRow: { flexDirection: 'row', gap: spacing.sm },
  languageButton: { flex: 1 },
}));
