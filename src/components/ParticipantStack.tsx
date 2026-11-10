// src/components/ParticipantStack.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { BasketParticipant } from '../lib/types';
import { colors, fonts, fontSizes, radii } from '../theme';
import { Avatar } from './Avatar';

interface ParticipantStackProps {
  participants: BasketParticipant[];
  size?: number;
  max?: number;
}

/** Overlapping avatar row with a +N bubble for extra contributors. */
export function ParticipantStack({ participants, size = 30, max = 4 }: ParticipantStackProps) {
  const shown = participants.slice(0, max);
  const extra = participants.length - shown.length;

  return (
    <View style={styles.row}>
      {shown.map((participant, index) => (
        <View
          key={participant.id}
          style={[styles.item, { marginStart: index === 0 ? 0 : -size * 0.3, zIndex: index }]}
        >
          <Avatar name={participant.name} size={size} tone={participant.tone} />
        </View>
      ))}
      {extra > 0 ? (
        <View
          style={[
            styles.more,
            {
              width: size,
              height: size,
              marginStart: -size * 0.3,
              zIndex: shown.length,
            },
          ]}
        >
          <Text style={[styles.moreText, { fontSize: size * 0.32 }]}>+{extra}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  item: {},
  more: {
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: { fontFamily: fonts.extrabold, fontSize: fontSizes.xs, color: colors.ink },
});
