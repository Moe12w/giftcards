import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { ClaimCardArt } from '@/src/components/ClaimCardArt';
import { GiftMediaView } from '@/src/components/GiftMediaView';
import { IconTile } from '@/src/components/IconTile';
import { Money } from '@/src/components/Money';
import { Screen } from '@/src/components/Screen';
import { fetchClaimBasket, fetchClaimGift, type ClaimBasket, type ClaimGift } from '@/src/lib/claim';
import { useThemeRefresh } from '@/src/lib/theme';
import { formatDate } from '@/src/lib/time';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '@/src/theme';
import { Glyph } from '@/src/components/Glyph';

export default function ClaimLandingScreen() {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [gift, setGift] = useState<ClaimGift | null>(null);
  const [basket, setBasket] = useState<ClaimBasket | null>(null);
  const [isBasket, setIsBasket] = useState(false);
  // No id means there is nothing to fetch: start settled rather than
  // flipping the flag from inside the effect.
  const [loading, setLoading] = useState(!token);

  useEffect(() => {
    let active = true;
    if (!token) return;
    fetchClaimGift(token)
      .then((row) => {
        if (!active) return;
        if (row) {
          setGift(row);
        } else {
          // Not a gift card — try basket.
          fetchClaimBasket(token)
            .then((b) => {
              if (!active) return;
              if (b) {
                setBasket(b);
                setIsBasket(true);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => active && setGift(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [token]);


  if (!token) {
    return (
      <Screen>
        <View style={styles.center}>
          <Glyph name="help" size={40} />
          <Text style={styles.title}>{t('claim.invalidTitle')}</Text>
          <Text style={styles.subtitle}>{t('claim.invalidBody')}</Text>
        </View>
      </Screen>
    );
  }

  if (!loading && !gift && !basket) {
    return (
      <Screen>
        <View style={styles.center}>
          <Glyph name="help" size={40} />
          <Text style={styles.title}>{t('claim.invalidTitle')}</Text>
          <Text style={styles.subtitle}>{t('claim.invalidBody')}</Text>
        </View>
      </Screen>
    );
  }

  if (isBasket && basket) {
    return (
      <Screen>
        <View style={styles.hero}>
          <View style={styles.blob} />
          <View style={styles.heroCircle}>
            <Glyph name="book" size={44} />
          </View>
          <Text style={styles.title}>{t('basket.claimTitle', { defaultValue: 'A gift book for you' })}</Text>
          <Text style={styles.subtitle}>{t('basket.claimSubtitle', { defaultValue: 'From {{name}}', name: basket.creatorName })}</Text>
        </View>

        <Card tone="teal">
          <View style={styles.vendorRow}>
            <IconTile icon="book" size={56} tone="gold" />
            <View style={styles.vendorCopy}>
              <Text style={styles.vendor}>{basket.name}</Text>
              <Text style={styles.from}>{t('basket.forRecipient', { name: basket.recipientName })}</Text>
            </View>
          </View>
          {basket.note ? (
            <View style={styles.messageBox}>
              <Text style={styles.messageLabel}>{t('claim.messageLabel')}</Text>
              <Text style={styles.message}>{basket.note}</Text>
            </View>
          ) : null}
          <Text style={styles.expires}>
            {basket.itemCount} {basket.itemCount === 1 ? 'gift card' : 'gift cards'} · {basket.totalMinor > 0 ? `QAR ${(basket.totalMinor / 100).toFixed(0)}` : ''}
          </Text>
        </Card>

        <Button
          label={t('claimExtra.openCta')}
          onPress={() => router.push(`/claim/${token}/add`)}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.blob} />
        <View style={styles.heroCircle}>
          <Glyph name="gift" size={44} />
        </View>
        <Text style={styles.title}>{t('claim.title')}</Text>
        <Text style={styles.subtitle}>{t('claim.subtitle', { vendor: gift?.vendor ?? '', amount: '' })}</Text>
      </View>

      {gift ? <ClaimCardArt gift={gift} height={240} style={styles.cardArt} /> : null}

      <Card tone="teal">
        <View style={styles.vendorRow}>
          <IconTile icon="coffee" size={56} tone="gold" />
          <View style={styles.vendorCopy}>
            <Text style={styles.vendor}>{gift?.vendor}</Text>
            <Text style={styles.from}>{t('claim.from', { name: gift?.sender ?? '' })}</Text>
          </View>
          <Money minor={gift?.amountMinor ?? 0} style={styles.amount} />
        </View>
        {gift?.media.map((item, index) => (
          <GiftMediaView
            key={`${item.url}-${index}`}
            media={item}
            height={180}
            style={styles.attachment}
          />
        ))}
        <View style={styles.messageBox}>
          <Text style={styles.messageLabel}>{t('claim.messageLabel')}</Text>
          <Text style={styles.message}>{gift?.message}</Text>
        </View>
        <Text style={styles.expires}>
          {t('claim.expires', {
            date: formatDate(gift?.expiresAt ?? null, i18n.language),
          })}
        </Text>
      </Card>

      <Button
        label={t('claimExtra.openCta')}
        onPress={() => router.push(isBasket ? `/claim/${token}/open-basket` : `/claim/${token}/open-envelope`)}
      />
    </Screen>
  );
}

const styles = themedStyles(() => ({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  cardArt: { alignSelf: 'center', maxWidth: 260 },
  attachment: { marginTop: spacing.sm },
  hero: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.lg },
  blob: {
    position: 'absolute',
    top: -6,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.pinkTint,
  },
  heroCircle: {
    width: 110,
    height: 110,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.display,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    textAlign: 'center',
  },
  vendorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  vendorCopy: { flex: 1, gap: 1 },
  vendor: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  from: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  amount: { fontSize: fontSizes.xl, color: colors.text },
  messageBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 2,
  },
  messageLabel: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  message: { fontFamily: fonts.regular, fontSize: fontSizes.md, color: colors.text, lineHeight: 21 },
  expires: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  note: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
}));
