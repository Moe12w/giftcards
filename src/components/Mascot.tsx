// src/components/Mascot.tsx
// The Giftly mascot — a bold, bubbly ring-tailed lemur drawn as a vector so it
// stays crisp at any size and works in both light and dark themes.
import React from 'react';
import { Circle, Ellipse, Path, Rect, Svg } from 'react-native-svg';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors } from '../theme';

interface MascotProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Bubbly lemur mascot. Drawn on a 200x200 canvas with thick ink outlines and
 * the marketplace's teal / lavender / coral / gold palette.
 */
export function Mascot({ size = 120, style }: MascotProps) {
  const ink = colors.ink;
  const fur = colors.teal;
  const furDark = colors.tealDark;
  const face = colors.creamSoft;
  const ear = colors.pink;
  const gold = colors.gold;
  const plum = colors.plum;

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" style={style} accessible={false}>
      {/* Striped tail, curling up behind the body. Dashes make the rings. */}
      <Path
        d="M136 156 C 188 154, 196 106, 170 76 C 156 58, 150 50, 160 32"
        fill="none"
        stroke={ink}
        strokeWidth={30}
        strokeLinecap="round"
      />
      <Path
        d="M136 156 C 188 154, 196 106, 170 76 C 156 58, 150 50, 160 32"
        fill="none"
        stroke={colors.surface}
        strokeWidth={23}
        strokeLinecap="round"
      />
      <Path
        d="M136 156 C 188 154, 196 106, 170 76 C 156 58, 150 50, 160 32"
        fill="none"
        stroke={ink}
        strokeWidth={23}
        strokeLinecap="butt"
        strokeDasharray="13 17"
      />

      {/* Feet */}
      <Ellipse cx={78} cy={178} rx={17} ry={11} fill={furDark} stroke={ink} strokeWidth={4} />
      <Ellipse cx={122} cy={178} rx={17} ry={11} fill={furDark} stroke={ink} strokeWidth={4} />

      {/* Body */}
      <Ellipse cx={100} cy={140} rx={47} ry={42} fill={fur} stroke={ink} strokeWidth={5} />
      <Ellipse cx={100} cy={146} rx={31} ry={28} fill={face} />

      {/* Arms hugging a gift */}
      <Ellipse cx={59} cy={142} rx={12} ry={20} fill={fur} stroke={ink} strokeWidth={4} transform="rotate(24 59 142)" />
      <Ellipse cx={141} cy={142} rx={12} ry={20} fill={fur} stroke={ink} strokeWidth={4} transform="rotate(-24 141 142)" />

      {/* Gift box */}
      <Rect x={80} y={124} width={40} height={36} rx={5} fill={ear} stroke={ink} strokeWidth={4} />
      <Rect x={96} y={124} width={8} height={36} fill={gold} />
      <Rect x={80} y={138} width={40} height={8} fill={gold} />
      <Circle cx={90} cy={120} r={8} fill={gold} stroke={ink} strokeWidth={3} />
      <Circle cx={110} cy={120} r={8} fill={gold} stroke={ink} strokeWidth={3} />

      {/* Ears */}
      <Circle cx={50} cy={58} r={19} fill={ink} />
      <Circle cx={50} cy={58} r={14} fill={ear} stroke={ink} strokeWidth={3} />
      <Circle cx={150} cy={58} r={19} fill={ink} />
      <Circle cx={150} cy={58} r={14} fill={ear} stroke={ink} strokeWidth={3} />

      {/* Head */}
      <Circle cx={100} cy={72} r={51} fill={furDark} stroke={ink} strokeWidth={5} />
      <Ellipse cx={100} cy={80} rx={39} ry={34} fill={face} />

      {/* Lemur eye patches */}
      <Ellipse cx={81} cy={72} rx={15} ry={17} fill={plum} />
      <Ellipse cx={119} cy={72} rx={15} ry={17} fill={plum} />

      {/* Big bubbly eyes */}
      <Circle cx={81} cy={72} r={10} fill={colors.surface} />
      <Circle cx={119} cy={72} r={10} fill={colors.surface} />
      <Circle cx={83} cy={73} r={5.5} fill={ink} />
      <Circle cx={121} cy={73} r={5.5} fill={ink} />
      <Circle cx={85} cy={70} r={2} fill={colors.surface} />
      <Circle cx={123} cy={70} r={2} fill={colors.surface} />

      {/* Nose and smile */}
      <Ellipse cx={100} cy={92} rx={5} ry={3.5} fill={ink} />
      <Path
        d="M88 99 Q100 111 112 99"
        fill="none"
        stroke={ink}
        strokeWidth={4}
        strokeLinecap="round"
      />
    </Svg>
  );
}
