// src/components/PosterCard.tsx
import React from 'react';
import { Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import type { AccentTone } from '../lib/types';
import { colors, edges, fonts, fontSizes, radii, spacing, themedStyles } from '../theme';
import { Glyph } from './Glyph';

/**
 * The website's `.offer-card` (the "Gifts people are sending this week" grid):
 * a pastel art panel with an outlined circle and a translucent tag, over a
 * white body with a dashed price/location footer — all inside the app's
 * 2px ink sticker frame with a hard bottom edge.
 */

const ART: Record<AccentTone, string> = {
  get teal() { return colors.teal; },
  get pink() { return colors.pink; },
  get lavender() { return colors.lavender; },
  get gold() { return colors.gold; },
  get sky() { return colors.sky; },
};

interface PosterCardProps {
  tone?: AccentTone;
  /** Translucent pill in the top-left of the art panel. */
  tag?: React.ReactNode;
  /** Top-right of the art panel, e.g. a rating pill or an arrow. */
  artRight?: React.ReactNode;
  /** Big outline glyph in the bottom-right of the art panel. */
  icon?: string;
  iconSize?: number;
  /** Replaces the glyph, e.g. a vendor logo. */
  iconNode?: React.ReactNode;
  title: string;
  subtitle?: string;
  titleNumberOfLines?: number;
  titleStyle?: StyleProp<TextStyle>;
  metaLeft?: React.ReactNode;
  metaRight?: React.ReactNode;
  /** Extra row below the meta footer. */
  footer?: React.ReactNode;
  children?: React.ReactNode;
  width?: number;
  artHeight?: number;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onPressIn?: () => void;
  accessibilityLabel?: string;
}

export function PosterCard({
  tone = 'lavender',
  tag,
  artRight,
  icon = 'gift',
  iconSize = 34,
  iconNode,
  title,
  subtitle,
  titleNumberOfLines = 2,
  titleStyle,
  metaLeft,
  metaRight,
  footer,
  children,
  width,
  artHeight = 122,
  style,
  onPress,
  onPressIn,
  accessibilityLabel,
}: PosterCardProps) {
  const card = (
    <View style={[styles.edge, width ? { width } : undefined, style]}>
      <View style={styles.surface}>
        <View
          style={[
            styles.art,
            { backgroundColor: ART[tone] ?? ART.lavender, minHeight: artHeight },
          ]}
        >
          <View style={styles.circle} />
          <View style={styles.artTop}>
            {tag ? (
              typeof tag === 'string' ? (
                <View style={styles.tag}>
                  <Text style={styles.tagText} numberOfLines={1}>
                    {tag}
                  </Text>
                </View>
              ) : (
                tag
              )
            ) : (
              <View />
            )}
            {artRight}
          </View>
          <View style={styles.artIcon}>
            {iconNode ?? <Glyph name={icon} size={iconSize} color={colors.ink} strokeWidth={2} />}
          </View>
        </View>

        <View style={styles.body}>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          <Text style={[styles.title, titleStyle]} numberOfLines={titleNumberOfLines}>
            {title}
          </Text>
          {children}
          {metaLeft !== undefined || metaRight !== undefined ? (
            <View style={styles.meta}>
              <View style={styles.metaLeft}>{metaLeft}</View>
              {metaRight !== undefined ? <View style={styles.metaRight}>{metaRight}</View> : null}
            </View>
          ) : null}
          {footer}
        </View>
      </View>
    </View>
  );

  if (!onPress) return card;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {card}
    </Pressable>
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
  art: {
    position: 'relative',
    padding: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    overflow: 'hidden',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  circle: {
    position: 'absolute',
    right: -34,
    bottom: -56,
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  artTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  tag: {
    maxWidth: '80%',
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  tagText: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xs,
    color: colors.textOnPastel,
  },
  artIcon: { alignSelf: 'flex-end', zIndex: 1 },
  body: {
    flex: 1,
    padding: spacing.md + 2,
    gap: spacing.sm,
    alignContent: 'flex-start',
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.lg,
    letterSpacing: -0.4,
    color: colors.text,
  },
  meta: {
    marginTop: 'auto',
    paddingTop: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  metaLeft: { flexShrink: 1 },
  metaRight: { flexShrink: 0, alignItems: 'flex-end' },
  pressed: { opacity: 0.88, transform: [{ translateY: 2 }] },
}));
