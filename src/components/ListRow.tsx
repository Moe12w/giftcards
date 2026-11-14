// src/components/ListRow.tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, fonts, fontSizes, spacing, themedStyles } from '../theme';
import { IconTile, type IconTileTone } from './IconTile';

interface ListRowProps {
  title: string;
  icon?: string;
  tone?: IconTileTone;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  last?: boolean;
}

export function ListRow({
  title,
  icon,
  tone = 'lavender',
  subtitle,
  value,
  onPress,
  showChevron = Boolean(onPress),
  last = false,
}: ListRowProps) {
  const content = (
    <View style={[styles.row, !last && styles.divider]}>
      {icon ? <IconTile icon={icon} size={42} tone={tone} /> : null}
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.value}>{value}</Text> : null}
      {showChevron ? <ChevronRight size={18} color={colors.textMuted} /> : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {content}
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  text: { flex: 1, gap: 1 },
  title: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  value: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  pressed: { opacity: 0.7 },
}));
