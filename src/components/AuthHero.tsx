// src/components/AuthHero.tsx
import React from 'react';
import { Text, View } from 'react-native';

import { Eyebrow, type EyebrowTone } from './Eyebrow';
import { Glyph } from './Glyph';
import { colors, edges, fonts, fontSizes, spacing, themedStyles } from '../theme';

interface FillStyle {
  background: string;
  edge: string;
}

const fills: Record<EyebrowTone, FillStyle> = {
  get gold() { return { background: colors.cream, edge: edges.gold }; },
  get teal() { return { background: colors.teal, edge: edges.teal }; },
  get lavender() { return { background: colors.lavender, edge: edges.lavender }; },
  get pink() { return { background: colors.pink, edge: edges.pink }; },
  get sky() { return { background: colors.sky, edge: edges.ink }; },
};

interface AuthHeroProps {
  /** Sticker above the title, e.g. "Start here". */
  eyebrow: string;
  title: string;
  subtitle?: string;
  glyph?: string;
  tone?: EyebrowTone;
  align?: 'center' | 'start';
  /** Size of the sticker plate; 0 hides it, for screens that lead with a form. */
  plateSize?: number;
  titleSize?: number;
  /** Renders the plate with a slightly playful tilt. */
  tilt?: boolean;
}

/**
 * The shared header for every auth screen: a pastel sticker plate, an eyebrow
 * pill, the title and an optional subtitle. Centred for the entry screens,
 * start-aligned for the step screens that sit under a back button.
 */
export function AuthHero({
  eyebrow,
  title,
  subtitle,
  glyph = 'gift',
  tone = 'teal',
  align = 'center',
  plateSize = 104,
  titleSize = fontSizes.display,
  tilt = true,
}: AuthHeroProps) {
  const centered = align === 'center';
  const fill = fills[tone] ?? fills.teal;

  return (
    <View style={[styles.wrap, centered && styles.center]}>
      {plateSize > 0 ? (
        <View style={[styles.plateWrap, { width: plateSize + 72, height: plateSize + 56 }]}>
          <View
            style={[
              styles.plateEdge,
              {
                backgroundColor: fill.edge,
                borderRadius: plateSize * 0.32,
                transform: [{ rotate: tilt ? '-4deg' : '0deg' }],
              },
            ]}
          >
            <View
              style={[
                styles.plate,
                {
                  backgroundColor: fill.background,
                  width: plateSize,
                  height: plateSize,
                  borderRadius: plateSize * 0.32,
                },
              ]}
            >
              <Glyph name={glyph} size={Math.round(plateSize * 0.44)} />
            </View>
          </View>
          {plateSize >= 84 ? (
            <>
              <Glyph name="star" size={18} color={colors.pink} style={styles.sparkleA} />
              <Glyph name="star" size={12} color={colors.gold} style={styles.sparkleB} />
            </>
          ) : null}
        </View>
      ) : null}

      <Eyebrow label={eyebrow} tone={tone} style={centered ? styles.centerEyebrow : undefined} />

      <Text
        style={[
          styles.title,
          { fontSize: titleSize, lineHeight: Math.round(titleSize * 1.16) },
          centered && styles.centerText,
        ]}
      >
        {title}
      </Text>

      {subtitle ? (
        <Text style={[styles.subtitle, centered && styles.centerText]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: { gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xs },
  center: { alignItems: 'center' },
  plateWrap: { alignItems: 'center', justifyContent: 'center' },
  plateEdge: {
    borderWidth: 2,
    borderColor: colors.ink,
    paddingBottom: 5,
    paddingHorizontal: 0,
  },
  plate: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkleA: { position: 'absolute', top: 0, right: 14 },
  sparkleB: { position: 'absolute', bottom: 8, left: 10 },
  centerEyebrow: { alignSelf: 'center' },
  title: {
    fontFamily: fonts.extrabold,
    color: colors.text,
    letterSpacing: -0.5,
  },
  centerText: { textAlign: 'center' },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    lineHeight: 22,
  },
}));
