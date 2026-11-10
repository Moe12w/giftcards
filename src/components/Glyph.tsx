// src/components/Glyph.tsx
import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';

import { glyphIcon } from '../lib/glyphs';
import { colors } from '../theme';

interface GlyphProps {
  /** Semantic glyph key from `src/lib/glyphs.ts`. */
  name?: string | null;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}

/** Renders one of the shared outline icons. */
export function Glyph({
  name,
  size = 20,
  color = colors.ink,
  strokeWidth = 2,
  style,
}: GlyphProps) {
  const Icon = glyphIcon(name);
  return <Icon size={size} color={color} strokeWidth={strokeWidth} style={style} />;
}
