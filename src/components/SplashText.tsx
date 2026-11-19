// src/components/SplashText.tsx
import React from 'react';
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { colors, fontSizes, fonts, themedStyles } from '../theme';

export type SplashTone = 'lavender' | 'teal' | 'gold' | 'pink' | 'sky';

// Pastel plates keep the same colour in both themes, so only the lavender
// marketing highlight needs a dedicated palette token. The others are tinted
// pastels that stay legible over both light and dark canvases.
const SPLASHES: Record<SplashTone, string> = {
  get lavender() { return colors.splash; },
  get teal() { return 'rgba(114, 194, 184, 0.48)'; },
  get gold() { return 'rgba(242, 178, 51, 0.5)'; },
  get pink() { return 'rgba(244, 182, 179, 0.55)'; },
  get sky() { return 'rgba(185, 221, 255, 0.65)'; },
};

interface SplashTextProps {
  children: React.ReactNode;
  tone?: SplashTone;
  fontSize?: number;
  lineHeight?: number;
  /** Lines up the swipe with a centred heading. */
  center?: boolean;
  style?: StyleProp<TextStyle>;
  wrapStyle?: StyleProp<ViewStyle>;
}

/**
 * A heading phrase with a marker swipe painted behind it, matching the
 * `::after` highlight on the marketing site's hero titles. React Native has no
 * pseudo-elements or negative z-index, so the bar is an absolutely positioned
 * view rendered *before* the text — same paint order, same effect.
 *
 * Keep each usage to one short phrase: the bar is sized to a single line and
 * sits under the last line if the text wraps.
 */
export function SplashText({
  children,
  tone = 'lavender',
  fontSize = fontSizes.display,
  lineHeight,
  center = false,
  style,
  wrapStyle,
}: SplashTextProps) {
  const lh = lineHeight ?? Math.round(fontSize * 1.16);
  // Figtree has no Arabic glyphs; the system fallback does not want Latin
  // negative tracking, which would crowd its connected letterforms.
  const arabic = typeof children === 'string' && /[\u0600-\u06FF]/.test(children);

  return (
    <View style={[styles.wrap, center && styles.center, wrapStyle]}>
      <View
        style={[
          styles.splash,
          {
            backgroundColor: SPLASHES[tone] ?? SPLASHES.lavender,
            height: Math.round(lh * 0.38),
            bottom: Math.round(fontSize * 0.16),
          },
        ]}
      />
      <Text style={[styles.text, { fontSize, lineHeight: lh }, arabic && styles.arabic, style]}>
        {children}
      </Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: { alignSelf: 'flex-start', maxWidth: '100%' },
  center: { alignSelf: 'center' },
  splash: {
    position: 'absolute',
    left: -4,
    right: -4,
    borderRadius: 6,
    transform: [{ rotate: '-1.5deg' }],
  },
  text: {
    fontFamily: fonts.extrabold,
    color: colors.text,
    letterSpacing: -0.8,
  },
  arabic: { letterSpacing: 0 },
}));
