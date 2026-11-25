// src/components/VoiceWaveform.tsx
// A hand-drawn looking sound wave for a voice note on the back of a card.
// The bars are deterministic (derived from the duration) so the sketch stays
// the same every render, and they use the app's bold outlined ink style rather
// than a clinical audio-player look.
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { colors, radii, themedStyles } from '../theme';

interface VoiceWaveformProps {
  /** Length of the recording in seconds; shapes the sketch. */
  durationSeconds?: number;
  /** Width of the drawn area in pixels. */
  width?: number;
  /** Height of the tallest bar. */
  height?: number;
  /** Live recording level 0..1 jitters the bars while recording. */
  liveLevel?: number;
  barColor?: string;
}

export function VoiceWaveform({
  durationSeconds = 4,
  width = 220,
  height = 34,
  liveLevel = 0,
  barColor = colors.ink,
}: VoiceWaveformProps) {
  // A deterministic pseudo-random height per bar, seeded by duration. The
  // envelope tapers at both ends like a real spoken note.
  const bars = useMemo(() => {
    const count = Math.max(12, Math.min(48, Math.round(width / 6)));
    const seed = Math.max(1, Math.round(durationSeconds * 10));
    return Array.from({ length: count }, (_, index) => {
      const wave = Math.sin(index * 1.7 + seed) * Math.cos(index * 0.6 + seed / 3);
      const noise = Math.sin(index * 12.9898 + seed) * 43758.5453;
      const jitter = noise - Math.floor(noise);
      const envelope = Math.sin((index / (count - 1)) * Math.PI);
      const base = (0.25 + Math.abs(wave) * 0.5 + jitter * 0.25) * envelope;
      return Math.max(0.14, Math.min(1, base + (liveLevel ? Math.abs(wave) * liveLevel : 0)));
    });
  }, [width, durationSeconds, liveLevel]);

  const barWidth = 3;
  const gap = Math.max(1, (width - bars.length * barWidth) / Math.max(1, bars.length - 1));

  return (
    <View style={[styles.row, { width, height }]} accessibilityRole="image" accessibilityLabel="Voice note waveform">
      {bars.map((value, index) => (
        <View
          key={index}
          style={{
            width: barWidth,
            height: Math.max(3, value * height),
            borderRadius: radii.pill,
            backgroundColor: barColor,
            marginRight: index === bars.length - 1 ? 0 : gap,
          }}
        />
      ))}
    </View>
  );
}

const styles = themedStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center' },
}));
