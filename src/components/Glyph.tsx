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
  // Rendered through createElement: the glyph table holds stable module-level
  // components, so nothing is created here, but the JSX alias made it look as
  // though this render built a new component type.
  return React.createElement(glyphIcon(name), {
    size,
    color,
    strokeWidth,
    style,
  });
}
