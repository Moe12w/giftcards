// src/components/VoiceWaveform.tsx
// A pen-drawn sound wave for a voice note. Bars follow a deterministic,
// speech-shaped envelope so they read like a hand sketch rather than a
// clinical audio meter. While recording they gently breathe with the mic level.
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { colors, radii, themedStyles } from '../theme';

interface VoiceWaveformProps {
  durationSeconds?: number;
  width?: number;
  height?: number;
  liveLevel?: number;
  barColor?: string;
}

export function VoiceWaveform({
  durationSeconds = 4,
  width = 200,
  height = 32,
  liveLevel = 0,
  barColor = colors.ink,
}: VoiceWaveformProps) {
  const bars = useMemo(() => {
    const count = Math.max(28, Math.min(72, Math.round(width / 3.6)));
    const seed = Math.max(1, Math.round(durationSeconds * 7));
    const center = Math.floor(count / 2);
    return Array.from({ length: count }, (_, index) => {
      // Speech envelope: strong in the middle, softer at the ends, with
      // syllable-like bursts from mixed sine waves.
      const distance = Math.abs(index - center) / center;
      const envelope = Math.max(0.12, 1 - distance * 0.85);
      const syllable =
        Math.abs(Math.sin(index * 0.55 + seed)) * 0.6 +
        Math.abs(Math.cos(index * 0.21 + seed / 2)) * 0.4;
      const grain = Math.abs(Math.sin(index * 12.9898 + seed * 78.233));
      const base = envelope * (0.22 + syllable * 0.6 + grain * 0.18);
      const live = liveLevel ? Math.abs(Math.sin(index * 0.9 + seed)) * liveLevel * 0.3 : 0;
      return Math.max(0.1, Math.min(1, base + live));
    });
  }, [width, durationSeconds, liveLevel]);

  const barWidth = 2;
  const gap = Math.max(0.8, (width - bars.length * barWidth) / Math.max(1, bars.length - 1));

  return (
    <View style={[styles.row, { width, height }]} accessibilityRole="image" accessibilityLabel="Voice note waveform">
      {bars.map((value, index) => (
        <View
          key={index}
          style={{
            width: barWidth,
            height: Math.max(2, value * height),
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
