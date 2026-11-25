// src/components/GiftCoverCard.tsx
// The finished gift card: the sender's cover, photo or sticker, and note, over a
// small body with the offer and amount. Used on the cover picker and the send
// preview so the sender always sees exactly what they are designing.
import React from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, edges, fonts, fontSizes, radii, spacing, themedStyles } from '../theme';
import { GiftCoverArt } from './GiftCoverArt';
import { Money } from './Money';

interface GiftCoverCardProps {
  coverId?: string | null;
  stickerId?: string | null;
  photoUri?: string | null;
  message?: string;
  title?: string;
  amountMinor?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function GiftCoverCard({
  coverId,
  stickerId,
  photoUri,
  message,
  title,
  amountMinor,
  height = 220,
  style,
}: GiftCoverCardProps) {
  return (
    <View style={[styles.edge, style]}>
      <View style={styles.surface}>
        <GiftCoverArt
          coverId={coverId}
          stickerId={stickerId}
          photoUri={photoUri}
          message={message}
          height={height}
        />
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {title ?? ' '}
          </Text>
          {typeof amountMinor === 'number' ? (
            <Money minor={amountMinor} style={styles.amount} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  edge: {
    borderRadius: radii.offer,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: edges.ink,
    paddingBottom: 5,
  },
  surface: {
    borderRadius: radii.offer - 2,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm + 2,
  },
  title: {
    flexShrink: 1,
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.md,
    letterSpacing: -0.3,
    color: colors.text,
  },
  amount: { fontFamily: fonts.extrabold, fontSize: fontSizes.lg, color: colors.text },
}));
