// src/components/ClaimCardArt.tsx
// The card face the recipient sees when opening a claim link. It uses the same
// renderer as the sender's editor so the art is identical at both ends.
import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

import type { ClaimGift } from '../lib/claim';
import { colors, radii, themedStyles } from '../theme';
import { GiftCoverArt } from './GiftCoverArt';

interface ClaimCardArtProps {
  gift: ClaimGift | null;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function ClaimCardArt({ gift, height = 220, style }: ClaimCardArtProps) {
  return (
    <View style={[styles.card, { height }, style]}>
      <GiftCoverArt
        coverId={gift?.coverId ?? undefined}
        coverImageUrl={gift?.coverImageUrl}
        coverName={gift?.coverName ?? undefined}
        photoUri={gift?.media?.type === 'photo' ? gift.media.url : undefined}
        message={gift?.message ?? undefined}
        height={height}
      />
    </View>
  );
}

const styles = themedStyles(() => ({
  card: {
    width: '100%',
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.onCover,
    overflow: 'hidden',
  },
}));
