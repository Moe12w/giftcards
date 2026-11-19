// src/components/SectionHeader.tsx
import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, fontSizes, themedStyles } from '../theme';
import { SplashText } from './SplashText';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Paints the site's lavender highlighter swipe behind the section title. */
  splash?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({ title, actionLabel, onAction, splash = false, style }: SectionHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      {splash ? (
        <SplashText fontSize={fontSizes.xl} wrapStyle={styles.splashWrap}>
          {title}
        </SplashText>
      ) : (
        <Text style={styles.title}>{title}</Text>
      )}
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = themedStyles(() => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xl,
    color: colors.text,
  },
  action: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.text,
    textDecorationLine: 'underline',
  },
  splashWrap: { alignSelf: 'flex-start' },
}));
