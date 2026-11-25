// src/components/GiftCoverArt.tsx
// The printed face of a gift card: a designed cover with the sender's photo or
// sticker on top and their note along the bottom. One component so the chooser,
// the card editor, the send preview and checkout all show the same card.
import React, { useState } from 'react';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Line, Path, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { giftCover, type GiftCover } from '../lib/gift-covers';
import { giftSticker } from '../lib/gift-stickers';
import { fonts, fontSizes, radii, themedStyles } from '../theme';
import { Glyph } from './Glyph';

const VIEW_WIDTH = 200;
const VIEW_HEIGHT = 260;
/** Checker squares are 20 units so the band closes exactly at the card edge. */
const CHECKER = 20;

/** Reads the cover's printed words from i18n, tolerating an empty design. */
function useCoverWords(cover: GiftCover): string[] {
  const { t } = useTranslation();
  const words = t(`send.coverWords.${cover.nameKey}`, { returnObjects: true });
  return Array.isArray(words) ? (words as string[]) : [];
}

/** Decorative layer painted behind the words and the motif. */
function decoration(cover: GiftCover) {
  switch (cover.decoration) {
    case 'blobs':
      return (
        <G>
          <Circle cx={42} cy={54} r={50} fill={cover.decorationColor} opacity={0.32} />
          <Circle cx={168} cy={110} r={64} fill={cover.decorationColor} opacity={0.22} />
          <Circle cx={92} cy={236} r={56} fill={cover.decorationColor} opacity={0.3} />
          <Circle cx={-10} cy={180} r={38} fill={cover.decorationColor} opacity={0.24} />
        </G>
      );
    case 'checker': {
      const squares: React.ReactNode[] = [];
      const rows = 3;
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < VIEW_WIDTH / CHECKER; col += 1) {
          if ((row + col) % 2 !== 0) continue;
          squares.push(
            <Rect
              key={`${row}-${col}`}
              x={col * CHECKER}
              y={VIEW_HEIGHT - (rows - row) * CHECKER}
              width={CHECKER}
              height={CHECKER}
              fill={cover.decorationColor}
              opacity={0.85}
            />,
          );
        }
      }
      return <G>{squares}</G>;
    }
    case 'confetti': {
      const pieces: React.ReactNode[] = [];
      for (let index = 0; index < 22; index += 1) {
        const x = 12 + ((index * 53) % 180);
        const y = 16 + ((index * 71) % 220);
        const rotation = (index * 47) % 180;
        pieces.push(
          <G key={index} transform={`translate(${x} ${y}) rotate(${rotation})`}>
            <Rect
              x={-4}
              y={-2}
              width={index % 3 === 0 ? 4 : 8}
              height={index % 3 === 0 ? 8 : 4}
              rx={1.5}
              fill={cover.decorationColor}
              opacity={0.55}
            />
          </G>,
        );
      }
      return <G>{pieces}</G>;
    }
    case 'arch':
      return (
        <Path
          d="M38,260 L38,150 A62,62 0 0 1 162,150 L162,260 Z"
          fill={cover.decorationColor}
          opacity={0.85}
        />
      );
    case 'sunburst': {
      const rays: React.ReactNode[] = [];
      for (let index = 0; index < 26; index += 1) {
        const angle = (index / 26) * Math.PI * 2;
        const cx = 100;
        const cy = 128;
        const inner = 22;
        const outer = 190;
        rays.push(
          <Line
            key={index}
            x1={cx + Math.cos(angle) * inner}
            y1={cy + Math.sin(angle) * inner}
            x2={cx + Math.cos(angle) * outer}
            y2={cy + Math.sin(angle) * outer}
            stroke={cover.decorationColor}
            strokeWidth={3.2}
            opacity={0.5}
          />,
        );
      }
      return <G>{rays}</G>;
    }
    default:
      return null;
  }
}

interface GiftCoverArtProps {
  coverId?: string | null;
  stickerId?: string | null;
  photoUri?: string | null;
  /** The sender's note, shown on the white strip along the bottom. */
  message?: string;
  height?: number;
  /** Miniature version used in the cover gallery. */
  compact?: boolean;
}

export function GiftCoverArt({
  coverId,
  stickerId,
  photoUri,
  message,
  height = 220,
  compact = false,
}: GiftCoverArtProps) {
  const { t } = useTranslation();
  const cover = giftCover(coverId);
  const words = useCoverWords(cover);
  const sticker = giftSticker(stickerId);
  const [artWidth, setArtWidth] = useState(0);

  // Everything printed on the card scales together, so a gallery thumbnail is
  // a true miniature of the full-size card rather than a cropped version.
  const scale = compact ? 0.52 : 1;
  const block = cover.titleStyle === 'block';
  const gradientId = `cover-${cover.id}`;

  // A long single word ("Anniversary" on a narrow gallery tile) would otherwise
  // run past the printed edge. Shrink the words just enough to fit the card.
  const padding = compact ? 8 : 16;
  const longestWord = words.reduce((longest, word) => Math.max(longest, word.length), 0);
  const wordSize = (block ? 23 : 26) * scale;
  const fit =
    artWidth > 0 && longestWord > 0
      ? Math.min(1, (artWidth - padding * 2) / (longestWord * wordSize * 0.62))
      : 1;

  const title =
    words.length > 0 ? (
      <View style={[styles.words, cover.layout === 'titleTop' ? styles.wordsLeft : null]}>
        {words.map((word, index) => (
          <Text
            key={`${word}-${index}`}
            style={{
              color: cover.titleColor,
              fontFamily: block ? fonts.black : fonts.semibold,
              fontStyle: block ? 'normal' : 'italic',
              fontSize: wordSize * fit,
              lineHeight: (block ? 25 : 31) * scale * fit,
              letterSpacing: block ? 0.4 : 0.2,
              textTransform: block ? 'uppercase' : 'none',
            }}
          >
            {word}
          </Text>
        ))}
      </View>
    ) : null;

  const motif = (
    <View
      style={[
        styles.motif,
        {
          width: 92 * scale,
          height: 92 * scale,
          backgroundColor: 'rgba(255, 255, 255, 0.22)',
        },
      ]}
    >
      <Glyph name={cover.glyph} size={50 * scale} color={cover.ink} strokeWidth={1.8} />
    </View>
  );

  return (
    <View
      style={[styles.art, { height, backgroundColor: cover.background }]}
      onLayout={(event) => setArtWidth(event.nativeEvent.layout.width)}
    >
      <Svg
        style={styles.canvas}
        width="100%"
        height="100%"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0.35" y2="1">
            <Stop offset="0" stopColor={cover.background} />
            <Stop offset="1" stopColor={cover.backgroundTo} />
          </LinearGradient>
        </Defs>
        <Rect width={VIEW_WIDTH} height={VIEW_HEIGHT} fill={`url(#${gradientId})`} />
        {decoration(cover)}
      </Svg>

      {photoUri ? <Image source={photoUri} style={styles.photo} contentFit="cover" transition={150} /> : null}

      {photoUri ? (
        <View style={[styles.labelPill, compact && styles.labelPillCompact]}>
          <Text
            style={[styles.label, compact && styles.labelCompact, { color: cover.ink === '#FFFFFF' ? '#1C1C1C' : cover.titleColor }]}
            numberOfLines={1}
          >
            {t(`send.coverNames.${cover.nameKey}`)}
          </Text>
        </View>
      ) : (
        <View
          style={[
            styles.content,
            compact ? styles.contentCompact : styles.contentRoom,
            cover.layout === 'titleTop'
              ? styles.contentTop
              : cover.layout === 'titleBottom'
                ? styles.contentBottom
                : styles.contentCenter,
          ]}
        >
          {cover.layout === 'titleTop' ? title : null}
          {cover.layout === 'titleBottom' ? motif : null}
          {cover.layout === 'titleCenter' ? title : null}
          {cover.layout === 'motifOnly' || cover.layout === 'titleCenter' ? motif : null}
          {cover.layout === 'titleTop' ? motif : null}
          {cover.layout === 'titleBottom' ? title : null}
        </View>
      )}

      {sticker ? (
        <View
          style={[
            styles.sticker,
            compact ? styles.stickerCompact : styles.stickerFull,
            { bottom: message ? (compact ? 30 : 52) : compact ? 8 : 14 },
          ]}
        >
          <Glyph
            name={sticker.glyph}
            size={compact ? 18 : 30}
            color={sticker.tint}
            strokeWidth={2.2}
          />
        </View>
      ) : null}

      {message ? (
        <View style={styles.messageBar}>
          <Text style={[styles.message, compact && styles.messageCompact]} numberOfLines={2}>
            {message}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = themedStyles(() => ({
  art: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
  },
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  photo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
  },
  contentCompact: { padding: 8, gap: 4 },
  contentRoom: { padding: 16 },
  contentCenter: { justifyContent: 'center' },
  // Top-aligned designs stack the words and motif from the top, so neither
  // sits on the printed band along the bottom edge.
  contentTop: { justifyContent: 'flex-start' },
  contentBottom: { justifyContent: 'space-between' },
  words: { alignItems: 'center' },
  wordsLeft: { alignItems: 'flex-start', alignSelf: 'stretch' },
  motif: {
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    maxWidth: '78%',
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: '#1C1C1C',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  labelPillCompact: {
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  label: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.sm,
    letterSpacing: 0.2,
  },
  labelCompact: { fontSize: 8 },
  sticker: {
    position: 'absolute',
    right: 14,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: '#1C1C1C',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-7deg' }],
  },
  stickerFull: { width: 50, height: 50 },
  stickerCompact: { width: 32, height: 32, right: 8, borderRadius: radii.sm },
  messageBar: {
    alignSelf: 'stretch',
    borderTopWidth: 2,
    borderTopColor: '#1C1C1C',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  message: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    lineHeight: 21,
    color: '#1C1C1C',
  },
  messageCompact: {
    fontSize: fontSizes.xs,
    lineHeight: 15,
    paddingHorizontal: 0,
  },
}));
