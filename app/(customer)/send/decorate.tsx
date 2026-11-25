import React, { useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';

import { BackButton } from '@/src/components/BackButton';
import { GiftCoverArt } from '@/src/components/GiftCoverArt';
import { Glyph } from '@/src/components/Glyph';
import { Screen } from '@/src/components/Screen';
import { GIFT_STICKERS } from '@/src/lib/gift-stickers';
import { useGiftDraft } from '@/src/lib/gift-draft';
import { useThemeRefresh } from '@/src/lib/theme';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '@/src/theme';

/**
 * Card editor: the chosen cover at full size, with round tools underneath to
 * pin a photo from the phone, add a sticker, or clear what is on the card. The
 * note written on the previous step is printed along the bottom of the card.
 */
export default function DecorateScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const { draft, update } = useGiftDraft();
  const { width, height } = useWindowDimensions();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photoUri = draft.media?.type === 'photo' ? draft.media.uri : null;
  const stickerId = draft.media?.type === 'sticker' ? draft.media.stickerId : null;

  const cardHeight = Math.min(width * 1.28, height * 0.56);
  const cardWidth = Math.round(cardHeight * 0.7);

  async function pickPhoto() {
    setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(t('send.photoPermission'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      const uri = result.canceled ? null : (result.assets?.[0]?.uri ?? null);
      if (uri) {
        update({ media: { type: 'photo', uri } });
        setSheetOpen(false);
      }
    } catch (photoError) {
      console.error('[send] photo picker failed', photoError);
      setError(t('send.photoFailed'));
    }
  }

  function chooseSticker(id: string) {
    update({ media: { type: 'sticker', stickerId: id } });
    setSheetOpen(false);
  }

  return (
    <Screen scroll={false} hideBlobs style={styles.screen} contentStyle={styles.content}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Pressable
          onPress={() => router.push('/(customer)/send/preview')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <Glyph name="eye" size={18} color={colors.text} />
          <Text style={styles.headerLabel}>{t('send.preview')}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(customer)/send/wrapping')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.headerButton, styles.finish, pressed && styles.pressed]}
        >
          <Text style={styles.finishLabel}>{t('send.finish')}</Text>
        </Pressable>
      </View>

      <View style={styles.stage}>
        <View style={[styles.card, { width: cardWidth, height: cardHeight }]}>
          <GiftCoverArt
            coverId={draft.cover}
            stickerId={stickerId}
            photoUri={photoUri}
            message={draft.message || undefined}
            height={cardHeight}
          />
        </View>
      </View>

      <View style={styles.tools}>
        <Pressable
          onPress={pickPhoto}
          accessibilityRole="button"
          accessibilityLabel={t('send.addPhoto')}
          style={({ pressed }) => [styles.tool, pressed && styles.pressed]}
        >
          <Glyph name="camera" size={24} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => setSheetOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityLabel={t('send.addSticker')}
          accessibilityState={{ expanded: sheetOpen }}
          style={({ pressed }) => [
            styles.tool,
            stickerId ? styles.toolActive : null,
            pressed && styles.pressed,
          ]}
        >
          <Glyph name="star" size={24} color={colors.text} />
        </Pressable>
        {photoUri || stickerId ? (
          <Pressable
            onPress={() => update({ media: null })}
            accessibilityRole="button"
            accessibilityLabel={t('send.removeMedia')}
            style={({ pressed }) => [styles.tool, pressed && styles.pressed]}
          >
            <Glyph name="trash" size={24} color={colors.text} />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      {sheetOpen ? (
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t('send.stickersTitle')}</Text>
            <Pressable
              onPress={() => setSheetOpen(false)}
              accessibilityRole="button"
              accessibilityLabel={t('common.done')}
              hitSlop={8}
              style={({ pressed }) => [styles.check, pressed && styles.pressed]}
            >
              <Glyph name="check" size={20} color={colors.textOnInk} strokeWidth={2.6} />
            </Pressable>
          </View>
          <View style={styles.stickerGrid}>
            {GIFT_STICKERS.map((sticker) => {
              const active = stickerId === sticker.id;
              return (
                <Pressable
                  key={sticker.id}
                  onPress={() => chooseSticker(sticker.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t(`send.stickerNames.${sticker.id}`)}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <View style={[styles.sticker, active && styles.stickerActive]}>
                    <Glyph name={sticker.glyph} size={28} color={sticker.tint} strokeWidth={2.2} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = themedStyles(() => ({
  screen: { backgroundColor: colors.coverEditor },
  content: { gap: spacing.sm, paddingBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 42,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  headerLabel: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.text },
  finish: {
    marginLeft: 'auto',
    backgroundColor: colors.danger,
    borderColor: colors.border,
  },
  finishLabel: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.textOnInk },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.onCover,
    overflow: 'hidden',
  },
  tools: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md },
  tool: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolActive: { backgroundColor: colors.tealTint, borderColor: colors.tealDark },
  error: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.textOnInk,
    textAlign: 'center',
  },
  sheet: {
    // Floats over the card so opening the sheet never pushes the tools off a
    // small screen.
    position: 'absolute',
    left: spacing.gutter,
    right: spacing.gutter,
    bottom: spacing.md,
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.textMuted },
  check: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    backgroundColor: colors.tealDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sticker: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
  },
  stickerActive: { borderColor: colors.tealDark, backgroundColor: colors.tealTint },
  pressed: { opacity: 0.85 },
}));
