// src/components/GifSheet.tsx
// The "Choose a GIF" sheet from the reference: a white sheet that rises over
// the card builder, with a search field and a grid of the sender's own GIFs /
// recent images. Tapping one attaches it to the card back.
import React, { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import {
  AssetField,
  MediaType,
  Query,
  requestPermissionsAsync,
  type SortDescriptor,
} from 'expo-media-library';
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '../theme';
import { Glyph } from './Glyph';
import { TextField } from './TextField';

interface GifSheetProps {
  visible: boolean;
  onClose: () => void;
  onPick: (uri: string) => void;
}

interface Choice {
  id: string;
  uri: string;
  name: string;
}

export function GifSheet({ visible, onClose, onPick }: GifSheetProps) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const [choices, setChoices] = useState<Choice[]>([]);
  const [query, setQuery] = useState('');
  const slide = useSharedValue(0);

  async function load() {
    try {
      const permission = await requestPermissionsAsync();
      if (!permission.granted) return;
      const sort: SortDescriptor = { key: AssetField.CREATION_TIME, ascending: false };
      const assets = await new Query()
        .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
        .orderBy(sort)
        .limit(48)
        .exe();
      const gifs: Choice[] = [];
      const others: Choice[] = [];
      for (const asset of assets) {
        try {
          const [name, uri] = await Promise.all([asset.getFilename(), asset.getUri()]);
          const choice = { id: asset.id, uri, name: name ?? '' };
          if (/\.gif$/i.test(choice.name)) gifs.push(choice);
          else others.push(choice);
        } catch {
          // Skip assets we cannot resolve.
        }
      }
      // Prefer GIFs, but fall back to recent pictures so the sheet is useful.
      setChoices([...gifs, ...others].slice(0, 36));
    } catch (error) {
      console.error('[gif-sheet] library query failed', error);
    }
  }

  useEffect(() => {
    if (visible) {
      slide.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
      // Defer to a task so the async permission query (and its setState)
      // does not run synchronously inside the effect body.
      const handle = setTimeout(() => { void load(); }, 0);
      return () => clearTimeout(handle);
    }
    slide.value = 0;
  }, [visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - slide.value) * height }],
  }));

  const shown = query.trim()
    ? choices.filter((choice) => choice.name.toLowerCase().includes(query.trim().toLowerCase()))
    : choices;
  const columns = 3;
  const thumb = Math.floor((width - spacing.gutter * 2 - spacing.sm * (columns - 1)) / columns);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('cardBack.close')} />
      <Animated.View style={[styles.sheet, { maxHeight: height * 0.82 }, sheetStyle]}>
        <View style={styles.grabber} />
        <View style={styles.head}>
          <Pressable onPress={onClose} accessibilityRole="button" style={styles.round}>
            <Glyph name="x" size={20} color={colors.ink} />
          </Pressable>
          <Text style={styles.title}>{t('send.addGif')}</Text>
          <View style={styles.roundPlaceholder} />
        </View>
        <View style={styles.searchWrap}>
          <TextField
            value={query}
            onChangeText={setQuery}
            placeholder={t('cardBack.searchGifs')}
          />
        </View>
        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {shown.map((choice) => (
            <Pressable
              key={choice.id}
              onPress={() => onPick(choice.uri)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.thumb, { width: thumb, height: thumb }, pressed && styles.pressed]}
            >
              <Image source={choice.uri} style={styles.image} contentFit="cover" cachePolicy="memory-disk" />
            </Pressable>
          ))}
          {shown.length === 0 ? (
            <Text style={styles.empty}>{t('cardBack.noGifs')}</Text>
          ) : null}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = themedStyles(() => ({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: radii.offer, borderTopRightRadius: radii.offer,
    borderTopWidth: 2, borderLeftWidth: 2, borderRightWidth: 2, borderColor: colors.border,
    backgroundColor: colors.surface, overflow: 'hidden',
  },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: radii.pill, backgroundColor: colors.borderSoft, marginTop: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  round: { width: 40, height: 40, borderRadius: radii.pill, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  roundPlaceholder: { width: 40, height: 40 },
  title: { fontFamily: fonts.extrabold, fontSize: fontSizes.lg, color: colors.text },
  searchWrap: { paddingHorizontal: spacing.gutter },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.gutter, paddingBottom: spacing.xxl },
  thumb: { borderRadius: radii.md, borderWidth: 2, borderColor: colors.border, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  image: { width: '100%', height: '100%' },
  empty: { width: '100%', textAlign: 'center', paddingVertical: spacing.xl, fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted },
  pressed: { opacity: 0.82 },
}));
