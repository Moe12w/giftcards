// src/components/CoverCard.tsx
// An envelope cover, standing upright. It uses the app's card language — 2px
// ink frame, hard bottom edge, pastel art panel with an outlined circle and a
// translucent tag, white body — but in portrait, like a real envelope.
import React from 'react';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { giftCover, type GiftCover } from '../lib/gift-covers';
import type { AccentTone } from '../lib/types';
import { colors, edges, fonts, fontSizes, radii, spacing, themedStyles } from '../theme';
import { Glyph } from './Glyph';

interface CoverCardProps {
  cover: GiftCover;
  name: string;
  height?: number;
  title?: string;
  subtitle?: string;
  logoUrl?: string | null;
  meta?: string;
  compact?: boolean;
  /** When embedded in an already-framed card, skip the extra outer frame. */
  framed?: boolean;
  style?: object;
}

export function coverTone(cover: GiftCover): AccentTone {
  switch (cover.id) {
    case 'thankYou': return 'pink';
    case 'birthday': return 'gold';
    case 'congrats': return 'teal';
    case 'goodLuck': return 'sky';
    case 'anniversary': return 'lavender';
    case 'love': return 'pink';
    case 'justBecause': return 'gold';
    case 'treatYourself': return 'teal';
    case 'giftBox': return 'lavender';
    default: return 'lavender';
  }
}

const ART: Record<AccentTone, string> = {
  get teal() { return colors.teal; },
  get pink() { return colors.pink; },
  get lavender() { return colors.lavender; },
  get gold() { return colors.gold; },
  get sky() { return colors.sky; },
};

export function CoverCard({
  cover,
  name,
  height = 240,
  title,
  subtitle,
  logoUrl,
  meta,
  compact = false,
  framed = true,
  style,
}: CoverCardProps) {
  const art = colors.lavender;
  const resolved = cover && cover.id ? giftCover(cover.id) : cover;
  return (
    <View style={[framed ? styles.edge : styles.plain, { height }, style]}>
      <View style={styles.surface}>
        {/* Portrait art panel */}
        <View style={[styles.art, { backgroundColor: ART[coverTone(resolved)] ?? art }]}>
          <View style={styles.circle} />
          <View style={styles.tag}>
            <Text style={styles.tagText} numberOfLines={1}>{name}</Text>
          </View>
          <View style={styles.artIcon}>
            {logoUrl ? (
              <View style={styles.logo}>
                <Image source={logoUrl} style={styles.logoImage} contentFit="contain" cachePolicy="memory-disk" />
              </View>
            ) : (
              <Glyph name={resolved.glyph} size={compact ? 40 : 56} color={colors.ink} strokeWidth={1.8} />
            )}
          </View>
        </View>

        {/* White body */}
        <View style={styles.body}>
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle ?? name}</Text>
          <Text style={styles.title} numberOfLines={2}>{title ?? name}</Text>
          <View style={styles.footer}>
            <Text style={styles.footerText} numberOfLines={1}>{meta ?? ''}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  plain: { overflow: 'hidden' },
  edge: {
    borderRadius: radii.offer,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: edges.ink,
    paddingBottom: 5,
    overflow: 'hidden',
  },
  surface: {
    flex: 1,
    borderRadius: radii.offer - 2,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  art: {
    height: '58%',
    position: 'relative',
    padding: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  circle: {
    position: 'absolute',
    right: -46,
    top: -46,
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  tag: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    maxWidth: '84%',
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.82)',
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  tagText: { fontFamily: fonts.extrabold, fontSize: 10, letterSpacing: 0.4, color: colors.textOnPastel, textTransform: 'uppercase' },
  artIcon: { marginBottom: spacing.sm },
  logo: { width: 52, height: 52, borderRadius: radii.pill, borderWidth: 2, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  logoImage: { width: 36, height: 36 },
  body: { flex: 1, padding: spacing.md, gap: 4 },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  title: { fontFamily: fonts.extrabold, fontSize: fontSizes.md, color: colors.text },
  footer: { marginTop: 'auto', paddingTop: spacing.xs, borderTopWidth: 1.5, borderTopColor: colors.borderSoft },
  footerText: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
}));
