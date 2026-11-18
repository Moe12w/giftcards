// src/components/Skeleton.tsx
// The grey shapes a screen shows while its data is on the way. They mirror the
// real layout, so content lands without the page jumping.
import React, { useEffect, useState } from 'react';
import { Animated, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, spacing, themedStyles } from '../theme';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width = '100%', height = 14, radius = 8, style }: SkeletonProps) {
  // A lazily-created animated value: it is built once, and holding it in state
  // (rather than a ref read during render) keeps the React Compiler rules happy.
  const [pulse] = useState(() => new Animated.Value(0.45));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.95, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.surfaceSunken, opacity: pulse },
        style,
      ]}
    />
  );
}

/** Placeholder for a list of cards. */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.row}>
          <Skeleton width={56} height={56} radius={16} />
          <View style={styles.rowCopy}>
            <Skeleton width="70%" height={16} />
            <Skeleton width="45%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Placeholder for the business detail screen. */
export function BusinessSkeleton() {
  return (
    <View style={styles.stack}>
      <Skeleton height={150} radius={radii.lg} />
      <View style={styles.hero}>
        <Skeleton width={72} height={72} radius={20} />
        <View style={styles.rowCopy}>
          <Skeleton width="65%" height={22} />
          <Skeleton width="40%" height={12} />
        </View>
      </View>
      <Skeleton width="35%" height={18} />
      <SkeletonList rows={2} />
    </View>
  );
}

/** Placeholder for the gift detail screen. */
export function GiftSkeleton() {
  return (
    <View style={styles.stack}>
      <View style={styles.hero}>
        <Skeleton width={72} height={72} radius={20} />
        <View style={styles.rowCopy}>
          <Skeleton width="70%" height={22} />
          <Skeleton width="45%" height={12} />
        </View>
      </View>
      <Skeleton width="100%" height={92} radius={radii.md} />
      <Skeleton width="30%" height={18} />
      <SkeletonList rows={2} />
    </View>
  );
}

const styles = themedStyles(() => ({
  list: { gap: spacing.sm },
  stack: { gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.borderSoft,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  rowCopy: { flex: 1, gap: spacing.xs },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
}));
