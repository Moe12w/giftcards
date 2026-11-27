// src/components/GiftCoverArt.tsx
// The printed face of a gift card: a designed cover with the sender's photo or
// sticker on top and their note along the bottom. One component so the chooser,
// the card editor, the send preview and checkout all show the same card.
import React, { useState } from 'react';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Line, Path, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import {
  giftCover,
  GIFT_COVERS,
  type CoverIllustration,
  type GiftCover,
} from '../lib/gift-covers';
import { giftSticker } from '../lib/gift-stickers';
import { fonts, fontSizes, radii, themedStyles } from '../theme';
import { Glyph } from './Glyph';

const VIEW_WIDTH = 200;
const VIEW_HEIGHT = 260;
/** Checker squares are 20 units so the band closes exactly at the card edge. */
const CHECKER = 20;

/** Watercolour panels generated for the printed covers, bundled with the app. */
const ILLUSTRATION_SOURCES: Record<CoverIllustration, number> = {
  birthday: require('../../assets/covers/birthday.jpg'),
  bath: require('../../assets/covers/bath.jpg'),
  flowers: require('../../assets/covers/flowers.jpg'),
  fireworks: require('../../assets/covers/fireworks.jpg'),
};

/** Reads the cover's printed words from i18n, tolerating an empty design. */
function useCoverWords(cover: GiftCover): string[] {
  const { t } = useTranslation();
  const words = t(`send.coverWords.${cover.nameKey}`, { returnObjects: true });
  return Array.isArray(words) ? (words as string[]) : [];
}

/** Scattered shape colours, falling back to the cover's single decoration ink. */
function paletteOf(cover: GiftCover): string[] {
  return cover.palette && cover.palette.length > 0 ? cover.palette : [cover.decorationColor];
}

/** A five-point star, painted the same way as the other scattered shapes. */
function starPath(cx: number, cy: number, radius: number): string {
  const points: string[] = [];
  for (let index = 0; index < 10; index += 1) {
    const pointRadius = index % 2 === 0 ? radius : radius * 0.44;
    const angle = (index / 10) * Math.PI * 2 - Math.PI / 2;
    points.push(
      `${cx + Math.cos(angle) * pointRadius},${cy + Math.sin(angle) * pointRadius}`,
    );
  }
  return `M${points.join(' L')} Z`;
}

/** Decorative layer painted behind the words and the illustration. */
function decoration(cover: GiftCover) {
  const palette = paletteOf(cover);
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
      for (let index = 0; index < 30; index += 1) {
        const x = 8 + ((index * 37) % 184);
        const y = 10 + ((index * 61) % 240);
        const rotation = (index * 43) % 180;
        const tall = index % 3 !== 0;
        pieces.push(
          <G key={index} transform={`translate(${x} ${y}) rotate(${rotation})`}>
            <Rect
              x={-2.5}
              y={tall ? -5 : -2.5}
              width={5}
              height={tall ? 10 : 5}
              rx={2.5}
              fill={palette[index % palette.length]}
              opacity={0.9}
            />
          </G>,
        );
      }
      // A few painted stars and dots between the confetti strips.
      for (let index = 0; index < 5; index += 1) {
        pieces.push(
          <Path
            key={`star-${index}`}
            d={starPath(22 + ((index * 47) % 160), 30 + ((index * 53) % 200), 6)}
            fill={palette[(index + 2) % palette.length]}
            opacity={0.85}
          />,
        );
      }
      return <G>{pieces}</G>;
    }
    case 'squiggles': {
      const waves = [
        { x: 8, y: 40 },
        { x: 118, y: 26 },
        { x: 20, y: 116 },
        { x: 126, y: 152 },
        { x: 4, y: 212 },
        { x: 130, y: 236 },
      ];
      return (
        <G>
          {waves.map((wave, index) => (
            <Path
              key={`wave-${index}`}
              d={`M${wave.x},${wave.y} q10,-14 20,0 t20,0`}
              fill="none"
              stroke={palette[index % palette.length]}
              strokeWidth={5}
              strokeLinecap="round"
              opacity={0.9}
            />
          ))}
          {[0, 1, 2, 3, 4].map((index) => (
            <Path
              key={`star-${index}`}
              d={starPath(30 + ((index * 41) % 150), 54 + ((index * 57) % 190), 7)}
              fill={palette[(index + 1) % palette.length]}
              opacity={0.9}
            />
          ))}
          {[0, 1, 2, 3].map((index) => (
            <Circle
              key={`dot-${index}`}
              cx={16 + ((index * 59) % 170)}
              cy={72 + ((index * 43) % 160)}
              r={3.4}
              fill={palette[(index + 2) % palette.length]}
              opacity={0.9}
            />
          ))}
        </G>
      );
    }
    case 'dots': {
      const pieces: React.ReactNode[] = [];
      for (let index = 0; index < 14; index += 1) {
        const x = 10 + ((index * 43) % 180);
        const y = 14 + ((index * 67) % 230);
        const size = 3 + (index % 3) * 2.2;
        const color = palette[index % palette.length];
        pieces.push(
          index % 4 === 0 ? (
            <Circle
              key={`ring-${index}`}
              cx={x}
              cy={y}
              r={size + 3}
              fill="none"
              stroke={color}
              strokeWidth={2.4}
              opacity={0.8}
            />
          ) : (
            <Circle key={`dot-${index}`} cx={x} cy={y} r={size} fill={color} opacity={0.85} />
          ),
        );
      }
      for (let index = 0; index < 5; index += 1) {
        pieces.push(
          <Path
            key={`star-${index}`}
            d={starPath(26 + ((index * 51) % 156), 34 + ((index * 71) % 200), 6)}
            fill={palette[(index + 2) % palette.length]}
            opacity={0.85}
          />,
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
  /** URL of an uploaded cover image (admin catalogue or customer art). */
  coverImageUrl?: string | null;
  /** Label for an uploaded cover, printed on the photo pill. */
  coverName?: string | null;
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
  coverImageUrl,
  coverName,
  message,
  height = 220,
  compact = false,
}: GiftCoverArtProps) {
  const { t } = useTranslation();
  // An explicit image always wins. Otherwise resolve against the loaded
  // catalogue passed in `coverId`, falling back to the built-in designs.
  const cover: GiftCover = coverImageUrl
    ? { ...GIFT_COVERS[0], id: coverId ?? 'uploaded', nameKey: 'custom', imageUrl: coverImageUrl, name: coverName ?? undefined, layout: 'motifOnly' }
    : giftCover(coverId);
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
  const titleColors = cover.titleColors?.length ? cover.titleColors : [cover.titleColor];

  const title =
    words.length > 0 ? (
      <View style={[styles.words, cover.layout === 'titleTop' ? styles.wordsLeft : null]}>
        {words.map((word, index) => (
          <Text
            key={`${word}-${index}`}
            style={{
              color: titleColors[index % titleColors.length],
              fontFamily: block ? fonts.black : fonts.semibold,
              fontStyle: block ? 'normal' : 'italic',
              fontSize: wordSize * fit,
              lineHeight: (block ? 25 : 31) * scale * fit,
              letterSpacing: block ? 0.4 : 0.2,
              textTransform: block ? 'uppercase' : 'none',
              // Each word sits at a slightly different angle, as though the
              // lettering were pasted onto the card by hand.
              transform: [{ rotate: `${index % 2 === 0 ? -2 : 1.6}deg` }],
              textShadowColor: block ? 'rgba(28, 28, 28, 0.35)' : 'transparent',
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 1,
            }}
          >
            {word}
          </Text>
        ))}
      </View>
    ) : null;

  const illustrationSize = compact ? height * 0.4 : Math.min(122, height * 0.5);
  const motif = cover.illustration ? (
    <View
      style={[
        styles.illustration,
        {
          width: illustrationSize,
          height: illustrationSize,
          transform: [{ rotate: cover.id.length % 2 === 0 ? '2.5deg' : '-2.5deg' }],
        },
      ]}
    >
      <Image
        source={ILLUSTRATION_SOURCES[cover.illustration]}
        style={styles.illustrationImage}
        contentFit="cover"
        transition={150}
      />
    </View>
  ) : (
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
        {cover.imageUrl ? null : decoration(cover)}
      </Svg>

      {cover.imageUrl ? (
        <Image source={cover.imageUrl} style={styles.photo} contentFit="cover" transition={150} />
      ) : null}

      {photoUri ? <Image source={photoUri} style={styles.photo} contentFit="cover" transition={150} /> : null}

      {photoUri ? (
        <View style={[styles.labelPill, compact && styles.labelPillCompact]}>
          <Text
            style={[styles.label, compact && styles.labelCompact, { color: cover.ink === '#FFFFFF' ? '#1C1C1C' : cover.titleColor }]}
            numberOfLines={1}
          >
            {cover.name ?? t(`send.coverNames.${cover.nameKey}`)}
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
          {cover.imageUrl ? null : (
            <>
              {cover.layout === 'titleTop' ? title : null}
              {cover.layout === 'titleBottom' ? motif : null}
              {cover.layout === 'titleCenter' ? title : null}
              {cover.layout === 'motifOnly' || cover.layout === 'titleCenter' ? motif : null}
              {cover.layout === 'titleTop' ? motif : null}
              {cover.layout === 'titleBottom' ? title : null}
            </>
          )}
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
    gap: 8,
  },
  contentCompact: { padding: 8, gap: 4 },
  contentRoom: { padding: 16 },
  contentCenter: { justifyContent: 'center' },
  // Top-aligned designs stack the words and illustration from the top, so
  // neither sits on the printed band along the bottom edge.
  contentTop: { justifyContent: 'flex-start' },
  contentBottom: { justifyContent: 'space-between' },
  words: { alignItems: 'center' },
  wordsLeft: { alignItems: 'flex-start', alignSelf: 'stretch' },
  motif: {
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The painted panel reads as a white card pasted onto the printed cover.
  illustration: {
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: '#1C1C1C',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  illustrationImage: { width: '100%', height: '100%' },
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
