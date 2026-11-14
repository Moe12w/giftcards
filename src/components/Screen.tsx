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
  edges?: Array<'top' | 'bottom' | 'left' | 'right'>;
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
  blobLilac: {
    position: 'absolute',
    top: -70,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(205, 184, 242, 0.30)',
  },
  blobMint: {
    position: 'absolute',
    bottom: 40,
    left: -90,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(114, 194, 184, 0.18)',
  },
}));
