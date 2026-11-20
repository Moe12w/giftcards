// src/components/Screen.tsx
import React from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, themedStyles } from '../theme';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  /** Adds room for the floating tab bar. */
  tabbed?: boolean;
}

export function Screen({
  children,
  scroll = true,
  style,
  contentStyle,
  edges = ['top'],
  tabbed = false,
}: ScreenProps) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, tabbed && styles.tabbed, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill, tabbed && styles.tabbed, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView edges={edges} style={[styles.safe, style]}>
      <View pointerEvents="none" style={styles.blobs}>
        <View style={styles.blobRing} />
        <View style={styles.blobLilac} />
        <View style={styles.blobMint} />
      </View>
      {body}
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  fill: { flex: 1 },
  tabbed: { paddingBottom: 120 },
  blobs: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  // Pastel bubbles that hang off the edges of the canvas, plus one outlined
  // ring so the decoration reads as stickers rather than a soft gradient.
  blobLilac: {
    position: 'absolute',
    top: -96,
    right: -84,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: colors.blobA,
  },
  blobMint: {
    position: 'absolute',
    bottom: 16,
    left: -104,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: colors.blobB,
  },
  blobRing: {
    position: 'absolute',
    top: 148,
    right: -48,
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 2,
    borderColor: colors.blobRing,
  },
}));
