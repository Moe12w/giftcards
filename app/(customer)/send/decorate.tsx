import React, { useEffect, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useTranslation } from 'react-i18next';

import { BackButton } from '@/src/components/BackButton';
import { GiftCoverArt } from '@/src/components/GiftCoverArt';
import { GiftMediaView } from '@/src/components/GiftMediaView';
import { Glyph } from '@/src/components/Glyph';
import { Screen } from '@/src/components/Screen';
import { fetchGiftCovers, resolveCover, coverLabel, GIFT_COVERS, type GiftCover } from '@/src/lib/gift-covers';
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
  const [covers, setCovers] = useState<GiftCover[]>(GIFT_COVERS);
  const [recording, setRecording] = useState(false);
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'document' });
  const recorderState = useAudioRecorderState(recorder);

  useEffect(() => {
    let active = true;
    fetchGiftCovers().then((items) => active && setCovers(items));
    return () => {
      active = false;
    };
  }, []);

  const selectedCover = resolveCover(draft.cover, covers);
  const photoUri = draft.media?.type === 'photo' ? draft.media.uri : null;
  const stickerId = draft.media?.type === 'sticker' ? draft.media.stickerId : null;
  const media = draft.media && draft.media.type !== 'sticker' ? draft.media : null;

  const cardHeight = Math.min(width * 1.28, height * 0.4);
  const cardWidth = Math.round(cardHeight * 0.7);

  /** Opens the library for one kind of media and stores the picked file. */
  async function pick(kind: 'photo' | 'gif' | 'video') {
    setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(t('send.photoPermission'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: kind === 'video' ? ['videos'] : ['images'],
        // GIFs must keep their animation: no editing and full quality on Android.
        allowsEditing: kind === 'photo',
        quality: kind === 'gif' ? 1 : 0.8,
        videoMaxDuration: 60,
      });
      const asset = result.canceled ? null : result.assets?.[0] ?? null;
      if (!asset) return;
      if (kind === 'video') {
        update({ media: { type: 'video', uri: asset.uri, durationMs: asset.duration ?? undefined } });
      } else {
        update({ media: { type: kind, uri: asset.uri } });
      }
      setSheetOpen(false);
    } catch (pickError) {
      console.error('[send] media picker failed', pickError);
      setError(t('send.photoFailed'));
    }
  }

  async function toggleRecording() {
    setError(null);
    try {
      if (recording) {
        await recorder.stop();
        setRecording(false);
        if (recorder.uri) {
          update({
            media: {
              type: 'audio',
              uri: recorder.uri,
              durationMs: Math.round((recorderState.durationMillis ?? 0)),
            },
          });
        }
        return;
      }
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError(t('send.voicePermission'));
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (recordError) {
      console.error('[send] voice recording failed', recordError);
      setRecording(false);
      setError(t('send.voiceFailed'));
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
            coverImageUrl={selectedCover.imageUrl}
            coverName={coverLabel(selectedCover, t)}
            stickerId={stickerId}
            photoUri={photoUri}
            message={draft.message || undefined}
            height={cardHeight}
          />
        </View>
        {media ? (
          <GiftMediaView
            media={media}
            height={120}
            style={styles.attachment}
          />
        ) : null}
        {recording ? (
          <Text style={styles.recording}>{t('send.recording')}</Text>
        ) : null}
      </View>

      <View style={styles.tools}>
        <Pressable
          onPress={() => pick('photo')}
          accessibilityRole="button"
          accessibilityLabel={t('send.addPhoto')}
          style={({ pressed }) => [styles.tool, pressed && styles.pressed]}
        >
          <Glyph name="camera" size={24} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => pick('gif')}
          accessibilityRole="button"
          accessibilityLabel={t('send.addGif')}
          style={({ pressed }) => [styles.tool, pressed && styles.pressed]}
        >
          <Glyph name="image" size={24} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => pick('video')}
          accessibilityRole="button"
          accessibilityLabel={t('send.addVideo')}
          style={({ pressed }) => [styles.tool, pressed && styles.pressed]}
        >
          <Glyph name="video" size={24} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={toggleRecording}
          accessibilityRole="button"
          accessibilityLabel={recording ? t('send.stopRecording') : t('send.addVoiceNote')}
          style={({ pressed }) => [
            styles.tool,
            recording ? styles.toolActive : null,
            pressed && styles.pressed,
          ]}
        >
          <Glyph name="mic" size={24} color={colors.text} />
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
        {draft.media ? (
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
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  attachment: { width: '100%', maxWidth: 320 },
  recording: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.onCover,
  },
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
