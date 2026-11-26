// src/components/BasketBook.tsx
// The basket's shared book.
//
// Every participant can write on a page, or add a photo, a GIF, a video or a
// voice note, exactly like the back of a gift card. The closed book is a small
// cover sitting in the basket page; pressing it grows it into a full-screen
// reader while the page behind it shrinks and blurs.
import React, { useCallback, useEffect, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import { BookOpen, Camera, Image as ImageIcon, Mic, Send, Trash2, Video, X } from 'lucide-react-native';

import { useAuth } from '../lib/auth';
import { useBaskets } from '../lib/baskets';
import { timeAgo } from '../lib/time';
import { useThemeRefresh } from '../lib/theme';
import type { BasketMessage, GiftBasket } from '../lib/types';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '../theme';
import { GiftCoverArt } from './GiftCoverArt';
import { GiftMediaView } from './GiftMediaView';
import { VoiceWaveform } from './VoiceWaveform';

/** The gap the reader keeps between its composer and the bottom of the screen. */
const READER_BOTTOM_INSET = 22;

/** A file the participant picked, before it is uploaded. */
interface PendingFile {
  type: 'photo' | 'gif' | 'video' | 'audio';
  uri: string;
  durationMs?: number;
}

function kindLabelKey(kind: PendingFile['type']): string {
  switch (kind) {
    case 'photo':
      return 'basket.book.photo';
    case 'gif':
      return 'basket.book.gif';
    case 'video':
      return 'basket.book.video';
    default:
      return 'basket.book.voiceNote';
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || '?';
}

/**
 * The closed book: the basket's chosen cover, with the recipient printed on it
 * and a small line that says how much is already inside. Pressing opens it.
 */
export function BasketBookCover({ basket, onOpen }: { basket: GiftBasket; onOpen: () => void }) {
  useThemeRefresh();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const coverWidth = Math.min(Math.max(200, width - spacing.gutter * 2 - 40), 300);
  const coverHeight = Math.round(coverWidth * 1.22);

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={t('basket.book.open')}
      style={({ pressed }) => [styles.coverPress, pressed && styles.pressed]}
    >
      <View style={[styles.coverWrap, { width: coverWidth }]}>
        <View style={styles.coverSpine} />
        <View style={[styles.coverFace, { height: coverHeight }]}>
          <GiftCoverArt
            coverId={basket.cover_id ?? undefined}
            message={basket.name}
            height={coverHeight}
          />
          <View style={styles.coverTo}>
            <Text style={styles.coverToText} numberOfLines={1}>
              {t('basket.book.forRecipient', { name: basket.recipient_name })}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.coverMeta}>
        <View style={styles.coverMetaCopy}>
          <Text style={styles.coverMetaTitle}>{t('basket.book.tapToOpen')}</Text>
          <Text style={styles.coverMetaCount}>
            {t('basket.book.entries', { count: basket.messages.length })}
          </Text>
        </View>
        <View style={styles.coverOpen}>
          <BookOpen size={18} color={colors.ink} />
        </View>
      </View>
    </Pressable>
  );
}

/**
 * The open book. It is drawn over the basket page so the blur behind it is a
 * real blur of the live screen, then grows from a small tilted cover into the
 * full reader.
 */
export function BasketBookReader({ basket, onClose }: { basket: GiftBasket; onClose: () => void }) {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { addBookEntry, removeBookEntry } = useBaskets();
  const lang: 'en' | 'ar' = i18n.language === 'ar' ? 'ar' : 'en';

  const { height: windowHeight } = useWindowDimensions();
  const [grow] = useState(() => new Animated.Value(0));
  const [keyboardRoom] = useState(() => new Animated.Value(0));
  const [writing, setWriting] = useState('');
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'document' });
  const recorderState = useAudioRecorderState(recorder);

  // The cover grows into the reader: it comes up, straightens and scales to
  // full size while the blurred page behind it fades in.
  useEffect(() => {
    Animated.spring(grow, {
      toValue: 1,
      damping: 20,
      stiffness: 190,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [grow]);

  // Closing puts the keyboard away first, so the book never springs back down
  // underneath a keyboard that is still on screen.
  const dismiss = useCallback(() => {
    Keyboard.dismiss();
    Animated.timing(grow, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onClose();
    });
  }, [grow, onClose]);

  // The book follows the keyboard by giving up room at its bottom edge, over the
  // keyboard's own duration, so the composer comes to rest just above the keys
  // and stays there instead of hopping up and crashing back down. It only ever
  // shrinks: sliding the whole reader up pushed its header - and the close
  // button in it - off the top of the screen. Android resizes the window for us.
  useEffect(() => {
    if (Platform.OS !== 'ios') return undefined;
    const subscription = Keyboard.addListener('keyboardWillChangeFrame', (event) => {
      const overlap = Math.max(0, windowHeight - event.endCoordinates.screenY);
      Animated.timing(keyboardRoom, {
        toValue: Math.min(overlap, Math.round(windowHeight * 0.62)),
        duration: Math.max(120, event.duration ?? 250),
        easing: Easing.bezier(0.17, 0.59, 0.4, 0.77),
        useNativeDriver: false,
      }).start();
    });
    return () => subscription.remove();
  }, [keyboardRoom, windowHeight]);

  // Android's hardware back closes the book, with its animation, instead of
  // leaving the basket page behind it.
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      dismiss();
      return true;
    });
    return () => subscription.remove();
  }, [dismiss]);

  const backdropStyle = { opacity: grow };
  const bookStyle = {
    opacity: grow.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' as const }),
    transform: [
      { scale: grow.interpolate({ inputRange: [0, 1], outputRange: [0.62, 1], extrapolate: 'clamp' as const }) },
      { translateY: grow.interpolate({ inputRange: [0, 1], outputRange: [70, 0], extrapolate: 'clamp' as const }) },
      { rotate: grow.interpolate({ inputRange: [0, 1], outputRange: ['-5deg', '0deg'], extrapolate: 'clamp' as const }) },
    ],
  };

  async function pick(kind: 'photo' | 'gif' | 'video') {
    setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(t('basket.book.photoPermission'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: kind === 'video' ? ['videos'] : ['images'],
        allowsEditing: false,
        quality: kind === 'gif' ? 1 : 0.8,
        videoMaxDuration: 60,
      });
      const asset = result.canceled ? null : result.assets?.[0] ?? null;
      if (!asset) return;
      setPending({
        type: kind,
        uri: asset.uri,
        ...(kind === 'video' ? { durationMs: asset.duration ?? undefined } : {}),
      });
    } catch (pickError) {
      console.error('[basket-book] media picker failed', pickError);
      setError(t('basket.book.photoFailed'));
    }
  }

  async function toggleRecording() {
    setError(null);
    try {
      if (recording) {
        await recorder.stop();
        setRecording(false);
        if (recorder.uri) {
          setPending({
            type: 'audio',
            uri: recorder.uri,
            durationMs: Math.round(recorderState.durationMillis ?? 0),
          });
        }
        return;
      }
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError(t('basket.book.voicePermission'));
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (recordError) {
      console.error('[basket-book] recording failed', recordError);
      setRecording(false);
      setError(t('basket.book.voiceFailed'));
    }
  }

  async function submit() {
    if (sending) return;
    const text = writing.trim();
    if (!pending && !text) return;
    setSending(true);
    setError(null);
    try {
      const added = await addBookEntry(basket.id, {
        kind: pending?.type ?? 'text',
        text,
        file: pending
          ? { uri: pending.uri, type: pending.type, durationMs: pending.durationMs }
          : undefined,
      });
      if (!added) {
        setError(t('basket.book.sendFailed'));
        return;
      }
      setWriting('');
      setPending(null);
    } catch (sendError) {
      console.error('[basket-book] could not add the page', sendError);
      setError(t('basket.book.sendFailed'));
    } finally {
      setSending(false);
    }
  }

  const canSend = Boolean(writing.trim() || pending) && !sending;
  const pages = basket.messages;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]} pointerEvents="box-none">
        <BlurView intensity={30} tint="default" style={StyleSheet.absoluteFill} />
        <View style={styles.scrim} />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel={t('basket.book.close')}
        />
      </Animated.View>

      <Animated.View
        style={[styles.readerArea, { paddingBottom: Animated.add(keyboardRoom, READER_BOTTOM_INSET) }]}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.reader, bookStyle]} accessibilityViewIsModal>
          <View style={styles.readerHead}>
            <View style={styles.readerThumb}>
              <GiftCoverArt coverId={basket.cover_id ?? undefined} height={62} compact />
            </View>
            <View style={styles.readerHeadCopy}>
              <Text style={styles.readerTitle} numberOfLines={1}>
                {t('basket.book.title', { name: basket.recipient_name })}
              </Text>
              <Text style={styles.readerSubtitle} numberOfLines={2}>
                {t('basket.book.subtitle')}
              </Text>
            </View>
            <Pressable
              onPress={dismiss}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('basket.book.close')}
              style={({ pressed }) => [styles.readerClose, pressed && styles.pressed]}
            >
              <X size={18} color={colors.ink} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.pages}
            contentContainerStyle={styles.pagesContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {pages.length === 0 ? (
              <View style={styles.emptyPage}>
                <BookOpen size={26} color={colors.textMuted} />
                <Text style={styles.emptyText}>{t('basket.book.empty')}</Text>
              </View>
            ) : (
              pages.map((page) => (
                <BookPage
                  key={page.id}
                  page={page}
                  lang={lang}
                  canDelete={page.author_id === user?.id}
                  onDelete={() => void removeBookEntry(basket.id, page.id)}
                />
              ))
            )}
          </ScrollView>

          {basket.status !== 'completed' ? (
            <View style={styles.composer}>
              {pending ? (
                <View style={styles.attachment}>
                  {pending.type === 'audio' ? (
                    <VoiceWaveform durationSeconds={(pending.durationMs ?? 0) / 1000 || 4} width={110} height={24} />
                  ) : pending.type === 'video' ? (
                    <Video size={20} color={colors.ink} />
                  ) : (
                    <Image source={pending.uri} style={styles.attachmentThumb} contentFit="cover" />
                  )}
                  <Text style={styles.attachmentLabel}>{t(kindLabelKey(pending.type))}</Text>
                  <Pressable
                    onPress={() => setPending(null)}
                    accessibilityRole="button"
                    accessibilityLabel={t('basket.book.remove')}
                    style={styles.attachmentRemove}
                  >
                    <X size={14} color={colors.ink} />
                  </Pressable>
                </View>
              ) : null}

              {recording ? (
                <View style={styles.recordingRow}>
                  <VoiceWaveform
                    liveLevel={0.5}
                    durationSeconds={Math.max(1, (recorderState.durationMillis ?? 0) / 1000)}
                    width={130}
                    height={22}
                  />
                  <Text style={styles.recordingLabel}>{t('basket.book.recording')}</Text>
                </View>
              ) : null}

              {error ? (
                <Text style={styles.error} accessibilityRole="alert">
                  {error}
                </Text>
              ) : null}

              <View style={styles.inputRow}>
                <TextInput
                  value={writing}
                  onChangeText={setWriting}
                  placeholder={t('basket.book.placeholder', { name: basket.recipient_name })}
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  multiline
                />
                <Pressable
                  onPress={() => void submit()}
                  disabled={!canSend}
                  accessibilityRole="button"
                  accessibilityLabel={t('basket.book.send')}
                  style={({ pressed }) => [
                    styles.send,
                    !canSend && styles.sendDisabled,
                    pressed && canSend && styles.pressed,
                  ]}
                >
                  <Send size={18} color={colors.textOnAccent} />
                </Pressable>
              </View>

              <View style={styles.tools}>
                <Pressable
                  onPress={() => void pick('photo')}
                  accessibilityRole="button"
                  accessibilityLabel={t('basket.book.addPhoto')}
                  style={({ pressed }) => [styles.tool, pressed && styles.pressed]}
                >
                  <Camera size={20} color={colors.ink} />
                </Pressable>
                <Pressable
                  onPress={() => void pick('gif')}
                  accessibilityRole="button"
                  accessibilityLabel={t('basket.book.addGif')}
                  style={({ pressed }) => [styles.tool, pressed && styles.pressed]}
                >
                  <ImageIcon size={20} color={colors.ink} />
                </Pressable>
                <Pressable
                  onPress={() => void pick('video')}
                  accessibilityRole="button"
                  accessibilityLabel={t('basket.book.addVideo')}
                  style={({ pressed }) => [styles.tool, pressed && styles.pressed]}
                >
                  <Video size={20} color={colors.ink} />
                </Pressable>
                <Pressable
                  onPress={() => void toggleRecording()}
                  accessibilityRole="button"
                  accessibilityLabel={recording ? t('basket.book.stopRecording') : t('basket.book.addVoice')}
                  style={({ pressed }) => [
                    styles.tool,
                    recording && styles.toolActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Mic size={20} color={colors.ink} />
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.closedNote}>
              <Text style={styles.closedNoteText}>{t('basket.book.readOnly')}</Text>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/** One page: the writing, or the photo / GIF / video / voice note on it. */
function BookPage({
  page,
  lang,
  canDelete,
  onDelete,
}: {
  page: BasketMessage;
  lang: 'en' | 'ar';
  canDelete: boolean;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const isMedia = page.kind !== 'text';
  return (
    <View style={styles.page}>
      <View style={styles.pageBody}>
        {isMedia && page.media ? (
          page.kind === 'photo' || page.kind === 'gif' ? (
            <Image source={page.media.url} style={styles.pageImage} contentFit="cover" transition={180} />
          ) : (
            <GiftMediaView
              media={{
                type: page.kind as 'video' | 'audio',
                url: page.media.url,
                durationMs: page.media.durationMs,
              }}
              height={190}
            />
          )
        ) : (
          <Text style={styles.pageText}>{page.text}</Text>
        )}
      </View>
      <View style={styles.pageFoot}>
        <View style={styles.pageAvatar}>
          <Text style={styles.pageAvatarText}>{initials(page.author_name)}</Text>
        </View>
        <Text style={styles.pageAuthor} numberOfLines={1}>
          {page.author_name}
        </Text>
        <Text style={styles.pageTime}>{timeAgo(page.created_at, lang)}</Text>
        {canDelete ? (
          <Pressable
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel={t('basket.book.delete')}
            style={({ pressed }) => [styles.pageDelete, pressed && styles.pressed]}
          >
            <Trash2 size={14} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  pressed: { opacity: 0.85, transform: [{ translateY: 2 }] },

  /* Closed book */
  coverPress: { alignSelf: 'center', gap: spacing.sm, width: '100%', alignItems: 'center' },
  coverWrap: { position: 'relative', alignSelf: 'center' },
  coverSpine: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: -2,
    width: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
    zIndex: 2,
  },
  coverFace: {
    borderRadius: radii.lg,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  coverTo: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    maxWidth: '70%',
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  coverToText: { fontFamily: fonts.bold, fontSize: fontSizes.xs, color: colors.text },
  coverMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, width: '100%' },
  coverMetaCopy: { flex: 1, gap: 0 },
  coverMetaTitle: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.text },
  coverMetaCount: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  coverOpen: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Open book */
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(20, 18, 16, 0.28)',
  },
  readerArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 62,
    paddingBottom: READER_BOTTOM_INSET,
    paddingHorizontal: spacing.gutter,
  },
  reader: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  readerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.borderSoft,
  },
  readerThumb: { width: 48, borderRadius: radii.sm, borderWidth: 2, borderColor: colors.border, overflow: 'hidden' },
  readerHeadCopy: { flex: 1, gap: 1 },
  readerTitle: { fontFamily: fonts.extrabold, fontSize: fontSizes.md, color: colors.text },
  readerSubtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    lineHeight: 15,
  },
  readerClose: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pages: { flex: 1 },
  pagesContent: { padding: spacing.sm, gap: spacing.sm, paddingBottom: spacing.md },
  emptyPage: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xl },
  emptyText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  page: {
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  pageBody: { padding: spacing.sm },
  pageText: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.text, lineHeight: 20 },
  pageImage: { width: '100%', height: 190, borderRadius: radii.sm },
  pageFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  pageAvatar: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageAvatarText: { fontFamily: fonts.bold, fontSize: 9, color: colors.textOnPastel },
  pageAuthor: { flex: 1, fontFamily: fonts.semibold, fontSize: fontSizes.xs, color: colors.text },
  pageTime: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  pageDelete: {
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composer: { borderTopWidth: 2, borderTopColor: colors.border, padding: spacing.sm, gap: spacing.xs },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.borderSoft,
    padding: spacing.xs,
  },
  attachmentThumb: { width: 28, height: 28, borderRadius: radii.sm },
  attachmentLabel: { flex: 1, fontFamily: fonts.semibold, fontSize: fontSizes.xs, color: colors.text },
  attachmentRemove: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.borderSoft,
  },
  recordingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  recordingLabel: { fontFamily: fonts.semibold, fontSize: fontSizes.xs, color: colors.textMuted },
  error: { fontFamily: fonts.semibold, fontSize: fontSizes.xs, color: colors.danger },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 96,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text,
    textAlignVertical: 'top',
  },
  send: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.tealDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
  tools: { flexDirection: 'row', gap: spacing.xs },
  tool: {
    flex: 1,
    height: 38,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolActive: { backgroundColor: colors.tealTint, borderColor: colors.tealDark },
  closedNote: { padding: spacing.sm, borderTopWidth: 2, borderTopColor: colors.borderSoft },
  closedNoteText: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
}));
