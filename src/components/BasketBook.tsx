// src/components/BasketBook.tsx
// The basket's shared book.
//
// Every participant can write on a page, or add a photo, a GIF, a video or a
// voice note. It is made to look like a real book someone put together by hand:
// a colourful cover with tape on it, handwriting, and an inside spread of paper
// notes. Pressing the cover swings it open on its spine and grows the book to
// full screen while the page behind it shrinks and blurs.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Animated,
  BackHandler,
  Easing,
  Keyboard,
  PanResponder,
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
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  Camera,
  Image as ImageIcon,
  Mic,
  Pause,
  Pencil,
  Play,
  Send,
  Trash2,
  Video,
  X,
} from 'lucide-react-native';

import { useAuth } from '../lib/auth';
import { useBaskets } from '../lib/baskets';
import { timeAgo } from '../lib/time';
import { useThemeRefresh } from '../lib/theme';
import type { BasketMessage, GiftBasket } from '../lib/types';
import { fonts, fontSizes, radii, spacing, themedStyles } from '../theme';
import { GiftCoverArt } from './GiftCoverArt';
import { GiftMediaView } from './GiftMediaView';
import { VoiceWaveform } from './VoiceWaveform';

/** The gap the reader keeps between its composer and the bottom of the screen. */
const READER_BOTTOM_INSET = 22;

/** How wide the open book may grow before it stops filling the screen. */
const BOOK_MAX_WIDTH = 520;

/**
 * Paper, not theme surfaces: the book is a printed object, so it keeps the same
 * warm paper and ink in light and dark mode, exactly like the printed card.
 */
const PAPER = {
  page: '#FFFCF5',
  left: '#FBDDE2',
  ink: '#2B2622',
  muted: '#847A6E',
  tape: 'rgba(236, 222, 182, 0.92)',
  rule: 'rgba(43, 38, 34, 0.12)',
  shadow: 'rgba(43, 38, 34, 0.22)',
  notes: ['#FFF6DF', '#FBE3E6', '#EFE8FB', '#E3F4F0', '#FDEFE4'],
  avatars: ['#F1DFB0', '#F4C7D1', '#D8CBF4', '#C6E8DE', '#F6D6C2'],
  accent: '#E0658C',
} as const;

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
 * Sizes that grow with the book, from the narrowest phone layout (320pt wide)
 * to the widest (430pt). The book itself is `bookWidth` points wide, so the
 * paper page and the handwriting on it scale together instead of clipping.
 */
function between(compact: number, roomy: number, ratio: number): number {
  return Math.round(compact + (roomy - compact) * ratio);
}

/** The room a 320pt phone leaves, and how much more a 430pt one leaves. */
const BOOK_WIDTH_TIGHT = 288;
const BOOK_WIDTH_ROOMY = 398;

/** Where a note sits on the page before anyone has dragged it. */
const NO_OFFSET = { x: 0, y: 0 };

/**
 * Keeps a note on the page: its saved position is clamped to the same bounds the
 * drag uses, so a note saved on another screen size (or stale data) can never
 * reopen hanging off the page.
 */
function clampNoteOffset(
  value: { x: number; y: number },
  column: number,
  width: number,
  gap: number,
  contentWidth: number,
): { x: number; y: number } {
  const base = column * (width + gap);
  return {
    x: Math.max(-base + 2, Math.min(contentWidth - width - base - 2, value?.x ?? 0)),
    y: Math.max(-70, Math.min(520, value?.y ?? 0)),
  };
}

/**
 * The closed book: the basket's cover design, with paper edges peeking out from
 * under it, tape holding it together and the recipient's name in handwriting.
 * Pressing it swings the cover open.
 */
export function BasketBookCover({ basket, onOpen }: { basket: GiftBasket; onOpen: () => void }) {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  const rtl = i18n.language === 'ar';
  const { width } = useWindowDimensions();
  const coverWidth = Math.min(Math.max(210, width - spacing.gutter * 2 - 56), 290);
  const coverHeight = Math.round(coverWidth * 1.24);

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={t('basket.book.open')}
      style={({ pressed }) => [styles.coverPress, pressed && styles.coverPressed]}
    >
      <View style={[styles.coverStage, { width: coverWidth, height: coverHeight }]}>
        <View style={[styles.pageEdge, styles.pageEdgeBack]} />
        <View style={[styles.pageEdge, styles.pageEdgeMid]} />
        <View style={styles.coverFront}>
          <View style={styles.coverClip}>
            <GiftCoverArt coverId={basket.cover_id ?? undefined} height={coverHeight} />
            <View style={[styles.coverSpine, rtl ? styles.spineRight : styles.spineLeft]} />
          </View>
          <View style={[styles.tape, styles.tapeTop]} />
          <View style={[styles.tape, styles.tapeBottom]} />
          <View style={[styles.coverLabel, rtl ? styles.coverLabelRtl : styles.coverLabelLtr]}>
            <Text style={[styles.coverLabelText, rtl && styles.textRtl]} numberOfLines={1}>
              {t('basket.book.forRecipient', { name: basket.recipient_name })}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.coverHint}>{t('basket.book.tapToOpen')}</Text>
      <Text style={styles.coverCount}>
        {t('basket.book.entries', { count: basket.messages.length })}
      </Text>
    </Pressable>
  );
}

/**
 * The open book. It is drawn over the basket page so the blur behind it is a
 * real blur of the live screen. Its cover swings open on the left spine, then
 * the spread of paper pages underneath grows to full size.
 */
export function BasketBookReader({ basket, onClose }: { basket: GiftBasket; onClose: () => void }) {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { addBookEntry, removeBookEntry } = useBaskets();
  const rtl = i18n.language === 'ar';
  const lang: 'en' | 'ar' = rtl ? 'ar' : 'en';

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const bookWidth = Math.min(windowWidth - spacing.gutter * 2, BOOK_MAX_WIDTH);
  // 0 on a 320pt phone, 1 on a 430pt one. Everything inside the spread is sized
  // from it, so the pink page never eats the writing page on a small screen.
  const roomy = Math.max(
    0,
    Math.min(1, (bookWidth - BOOK_WIDTH_TIGHT) / (BOOK_WIDTH_ROOMY - BOOK_WIDTH_TIGHT)),
  );
  const leftPageWidth = between(88, 118, roomy);
  const pagePadding = between(8, 10, roomy);
  // The writing page is split into two staggered columns of notes.
  const gutter = 10;
  const cardGap = between(8, 10, roomy);
  const pageWidth = bookWidth - leftPageWidth - gutter;
  const contentWidth = pageWidth - pagePadding * 2;
  const cardWidth = Math.max(72, Math.floor((contentWidth - cardGap) / 2));
  const [bookHeight, setBookHeight] = useState(Math.round(windowHeight * 0.72));
  const [opening] = useState(() => new Animated.Value(0));
  const [keyboardRoom] = useState(() => new Animated.Value(0));
  const [writing, setWriting] = useState('');
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  // A note being dragged stops the page scrolling underneath it.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [offsets, setOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [recording, setRecording] = useState(false);
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'document' });
  const recorderState = useAudioRecorderState(recorder);

  // Opening: the cover swings on its spine while the book rises and grows.
  useEffect(() => {
    Animated.timing(opening, {
      toValue: 1,
      duration: 640,
      easing: Easing.bezier(0.22, 0.61, 0.36, 1),
      useNativeDriver: true,
    }).start();
  }, [opening]);

  // Where everyone put the notes is remembered on this phone, so the page still
  // looks the way it was arranged the next time the book is opened.
  const layoutKey = `basket-book-layout:${basket.id}`;
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(layoutKey)
      .then((raw) => {
        if (!alive || !raw) return;
        const saved = JSON.parse(raw) as Record<string, { x: number; y: number }>;
        if (!saved || typeof saved !== 'object') return;
        const clamped: Record<string, { x: number; y: number }> = {};
        for (const [id, val] of Object.entries(saved)) {
          if (!val || typeof val.x !== 'number' || typeof val.y !== 'number') continue;
          const idx = basket.messages.findIndex((p) => p.id === id);
          const column = idx >= 0 ? idx % 2 : 0;
          clamped[id] = clampNoteOffset(val, column, cardWidth, cardGap, cardWidth * 2 + cardGap);
        }
        if (!alive) return;
        setOffsets(clamped);
        AsyncStorage.setItem(layoutKey, JSON.stringify(clamped)).catch(() => undefined);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [layoutKey, basket.messages, cardWidth, cardGap]);

  const moveNote = useCallback(
    (id: string, next: { x: number; y: number }) => {
      setOffsets((current) => {
        const idx = basket.messages.findIndex((p) => p.id === id);
        const column = idx >= 0 ? idx % 2 : 0;
        const clamped = clampNoteOffset(next, column, cardWidth, cardGap, cardWidth * 2 + cardGap);
        const merged = { ...current, [id]: clamped };
        AsyncStorage.setItem(layoutKey, JSON.stringify(merged)).catch(() => undefined);
        return merged;
      });
    },
    [layoutKey, basket.messages, cardWidth, cardGap],
  );

  // Closing puts the keyboard away first, so the book never springs back down
  // underneath a keyboard that is still on screen.
  const dismiss = useCallback(() => {
    Keyboard.dismiss();
    Animated.timing(opening, {
      toValue: 0,
      duration: 340,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onClose();
    });
  }, [opening, onClose]);

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
      Keyboard.dismiss();
      setComposerOpen(false);
    } catch (sendError) {
      console.error('[basket-book] could not add the page', sendError);
      setError(t('basket.book.sendFailed'));
    } finally {
      setSending(false);
    }
  }

  const canSend = Boolean(writing.trim() || pending) && !sending;
  const pages = basket.messages;

  // The cover is hinged on the book's leading edge: the left one, or the right
  // one when the app is in Arabic.
  const hinge = rtl ? bookWidth / 2 : -bookWidth / 2;

  const backdropStyle = { opacity: opening.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) };
  const bookStyle = {
    opacity: opening.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' as const }),
    transform: [
      { scale: opening.interpolate({ inputRange: [0, 1], outputRange: [0.68, 1], extrapolate: 'clamp' as const }) },
      { translateY: opening.interpolate({ inputRange: [0, 1], outputRange: [90, 0], extrapolate: 'clamp' as const }) },
    ],
  };
  const coverStyle = {
    transform: [
      { perspective: 1600 },
      { translateX: hinge },
      {
        rotateY: opening.interpolate({
          inputRange: [0.1, 0.9],
          outputRange: ['0deg', rtl ? '178deg' : '-178deg'],
          extrapolate: 'clamp' as const,
        }),
      },
      { translateX: -hinge },
    ],
  };

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
        <Animated.View
          style={[styles.book, { maxWidth: BOOK_MAX_WIDTH }, bookStyle]}
          onLayout={(event) => setBookHeight(event.nativeEvent.layout.height)}
          accessibilityViewIsModal
        >
          <View style={[styles.spread, rtl && styles.spreadRtl]}>
            {/* The inside of the front cover: the recipient, the wish and who
                the book is from, all in handwriting. */}
            <View
              style={[styles.leftPage, { width: leftPageWidth, paddingHorizontal: pagePadding }]}
            >
              <Text
                style={[
                  styles.leftTo,
                  { fontSize: between(17, 20, roomy), lineHeight: between(20, 23, roomy) },
                  rtl && styles.textRtl,
                ]}
                numberOfLines={2}
              >
                {t('basket.book.forRecipient', { name: basket.recipient_name })}
              </Text>
              <Text
                style={[
                  styles.leftWish,
                  { fontSize: between(24, 30, roomy), lineHeight: between(27, 33, roomy) },
                  rtl && styles.textRtl,
                ]}
                numberOfLines={5}
              >
                {basket.name}
              </Text>
              <View style={[styles.leftRule, rtl && styles.ruleRtl]} />
              <Text
                style={[
                  styles.leftFrom,
                  { fontSize: between(15, 17, roomy), lineHeight: between(19, 21, roomy) },
                  rtl && styles.textRtl,
                ]}
                numberOfLines={2}
              >
                {t('basket.book.fromCreator', { name: basket.creator_name })}
              </Text>
            </View>

            <View style={styles.gutter} />

            {/* The writing page: everyone's notes, then the composer. */}
            <View style={styles.rightPage}>
              <ScrollView
                style={styles.pages}
                contentContainerStyle={{
                  paddingHorizontal: pagePadding,
                  paddingTop: 46,
                  paddingBottom: 82,
                }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                scrollEnabled={!draggingId}
              >
                {pages.length > 0 ? (
                  <Text style={[styles.pageHint, rtl && styles.textRtl]}>
                    {t('basket.book.moveHint')}
                  </Text>
                ) : null}

                {pages.length === 0 ? (
                  <View style={styles.emptyPage}>
                    <BookOpen size={24} color={PAPER.muted} />
                    <Text style={styles.emptyText}>{t('basket.book.empty')}</Text>
                  </View>
                ) : (
                  // Two staggered columns of notes, stuck onto the page by hand
                  // instead of listed one under another.
                  <View style={[styles.collage, { gap: cardGap }, rtl && styles.collageRtl]}>
                    {[0, 1].map((column) => (
                      <View
                        key={column}
                        style={[
                          styles.column,
                          { width: cardWidth, gap: cardGap },
                          column === 1 && { marginTop: Math.round(cardWidth * 0.22) },
                        ]}
                      >
                        {pages
                          .map((page, index) => ({ page, index }))
                          .filter(({ index }) => index % 2 === column)
                          .map(({ page, index }) => (
                            <ScrapNote
                              key={page.id}
                              page={page}
                              index={index}
                              lang={lang}
                              roomy={roomy}
                              width={cardWidth}
                              gap={cardGap}
                              column={column}
                              contentWidth={cardWidth * 2 + cardGap}
                              offset={clampNoteOffset(
                                offsets[page.id] ?? NO_OFFSET,
                                column,
                                cardWidth,
                                cardGap,
                                cardWidth * 2 + cardGap,
                              )}
                              onMoved={moveNote}
                              dragging={draggingId === page.id}
                              onDraggingChange={(next) =>
                                setDraggingId(next ? page.id : null)
                              }
                              canDelete={page.author_id === user?.id}
                              onDelete={() => void removeBookEntry(basket.id, page.id)}
                            />
                          ))}
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>

              {basket.status !== 'completed' ? (
                composerOpen ? (
                  <View
                    style={[
                      styles.composerCard,
                      { left: pagePadding, right: pagePadding, bottom: pagePadding },
                    ]}
                  >
                    <View style={[styles.composerHead, rtl && styles.rowRtl]}>
                      <Text style={styles.composerTitle}>{t('basket.book.newNote')}</Text>
                      <Pressable
                        onPress={() => {
                          Keyboard.dismiss();
                          setComposerOpen(false);
                        }}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t('basket.book.close')}
                        style={styles.composerClose}
                      >
                        <X size={14} color={PAPER.muted} />
                      </Pressable>
                    </View>

                    {pending ? (
                      <View style={[styles.attachment, rtl && styles.rowRtl]}>
                        {pending.type === 'audio' ? (
                          <VoiceWaveform
                            durationSeconds={(pending.durationMs ?? 0) / 1000 || 4}
                            width={110}
                            height={24}
                            barColor={PAPER.accent}
                          />
                        ) : pending.type === 'video' ? (
                          <Video size={20} color={PAPER.ink} />
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
                          <X size={14} color={PAPER.ink} />
                        </Pressable>
                      </View>
                    ) : null}

                    {recording ? (
                      <View style={[styles.recordingRow, rtl && styles.rowRtl]}>
                        <VoiceWaveform
                          liveLevel={0.5}
                          durationSeconds={Math.max(1, (recorderState.durationMillis ?? 0) / 1000)}
                          width={120}
                          height={22}
                          barColor={PAPER.accent}
                        />
                        <Text style={[styles.recordingLabel, rtl && styles.textRtl]}>
                          {t('basket.book.recording')}
                        </Text>
                      </View>
                    ) : null}

                    {error ? (
                      <Text style={styles.error} accessibilityRole="alert">
                        {error}
                      </Text>
                    ) : null}

                    <TextInput
                      value={writing}
                      onChangeText={setWriting}
                      placeholder={t('basket.book.placeholder', { name: basket.recipient_name })}
                      placeholderTextColor={PAPER.muted}
                      style={[
                        styles.input,
                        { fontSize: between(18, 20, roomy), lineHeight: between(22, 24, roomy) },
                        rtl && styles.inputRtl,
                      ]}
                      multiline
                      autoFocus
                    />

                    <View style={[styles.composerFoot, rtl && styles.rowRtl]}>
                      <View style={[styles.tools, rtl && styles.rowRtl]}>
                        <Pressable
                          onPress={() => void pick('photo')}
                          accessibilityRole="button"
                          accessibilityLabel={t('basket.book.addPhoto')}
                          style={({ pressed }) => [styles.tool, pressed && styles.pressed]}
                        >
                          <Camera size={18} color={PAPER.ink} />
                        </Pressable>
                        <Pressable
                          onPress={() => void pick('gif')}
                          accessibilityRole="button"
                          accessibilityLabel={t('basket.book.addGif')}
                          style={({ pressed }) => [styles.tool, pressed && styles.pressed]}
                        >
                          <ImageIcon size={18} color={PAPER.ink} />
                        </Pressable>
                        <Pressable
                          onPress={() => void pick('video')}
                          accessibilityRole="button"
                          accessibilityLabel={t('basket.book.addVideo')}
                          style={({ pressed }) => [styles.tool, pressed && styles.pressed]}
                        >
                          <Video size={18} color={PAPER.ink} />
                        </Pressable>
                        <Pressable
                          onPress={() => void toggleRecording()}
                          accessibilityRole="button"
                          accessibilityLabel={
                            recording ? t('basket.book.stopRecording') : t('basket.book.addVoice')
                          }
                          style={({ pressed }) => [
                            styles.tool,
                            recording && styles.toolActive,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Mic size={18} color={recording ? PAPER.page : PAPER.ink} />
                        </Pressable>
                      </View>

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
                        <Send size={17} color={PAPER.page} />
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setComposerOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t('basket.book.write')}
                    style={({ pressed }) => [
                      styles.composeCta,
                      { bottom: pagePadding + 4 },
                      rtl ? styles.composeCtaRtl : styles.composeCtaLtr,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Pencil size={20} color={PAPER.page} />
                  </Pressable>
                )
              ) : (
                <View style={styles.closedNote}>
                  <Text style={[styles.closedNoteText, rtl && styles.textRtl]}>
                    {t('basket.book.readOnly')}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* The cover itself, hinged on the spine. Once it swings past the page
              plane its back faces away and it simply leaves the screen. */}
          <Animated.View style={[styles.flap, coverStyle]} pointerEvents="none">
            <GiftCoverArt coverId={basket.cover_id ?? undefined} height={bookHeight} />
            <View style={[styles.flapSpine, rtl ? styles.spineRight : styles.spineLeft]} />
            <View style={[styles.tape, styles.flapTapeTop]} />
            <View style={[styles.tape, styles.flapTapeBottom]} />
          </Animated.View>

          <Pressable
            onPress={dismiss}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('basket.book.close')}
            style={({ pressed }) => [
              styles.close,
              rtl ? styles.closeRtl : styles.closeLtr,
              pressed && styles.pressed,
            ]}
          >
            <X size={18} color={PAPER.ink} />
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/**
 * One piece stuck onto the scrapbook page: a note, a photo, a GIF, a video or a
 * voice note. Its name bar is also its handle, so a card can be dragged
 * anywhere on the page the way you would move a note on a real scrapbook.
 */
function ScrapNote({
  page,
  index,
  lang,
  roomy,
  width,
  gap,
  column,
  contentWidth,
  offset,
  onMoved,
  dragging,
  onDraggingChange,
  canDelete,
  onDelete,
}: {
  page: BasketMessage;
  index: number;
  lang: 'en' | 'ar';
  roomy: number;
  width: number;
  gap: number;
  column: number;
  contentWidth: number;
  offset: { x: number; y: number };
  onMoved: (id: string, next: { x: number; y: number }) => void;
  dragging: boolean;
  onDraggingChange: (next: boolean) => void;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const rtl = lang === 'ar';
  const pad = between(9, 11, roomy);
  const tint = PAPER.notes[index % PAPER.notes.length];
  const avatarTint = PAPER.avatars[index % PAPER.avatars.length];
  const [pos] = useState(() => new Animated.ValueXY(offset));

  // Saved positions arrive after the first render.
  useEffect(() => {
    pos.setValue(offset);
  }, [offset, pos]);

  const pan = useMemo(() => {
    // The card may travel across the page, but not off it.
    const base = column * (width + gap);
    const place = (dx: number, dy: number) => ({
      x: Math.max(-base + 2, Math.min(contentWidth - width - base - 2, offset.x + dx)),
      y: Math.max(-70, Math.min(520, offset.y + dy)),
    });
    return PanResponder.create({
      // Only the name bar picks up the card, so the page still scrolls when
      // you touch the note itself.
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => onDraggingChange(true),
      onPanResponderMove: (_event, gesture) => {
        pos.setValue(place(gesture.dx, gesture.dy));
      },
      onPanResponderRelease: (_event, gesture) => {
        onDraggingChange(false);
        onMoved(page.id, place(gesture.dx, gesture.dy));
      },
      onPanResponderTerminate: (_event, gesture) => {
        onDraggingChange(false);
        onMoved(page.id, place(gesture.dx, gesture.dy));
      },
    });
  }, [column, width, gap, contentWidth, offset, page.id, onMoved, onDraggingChange, pos]);

  const isText = page.kind === 'text';
  const mediaHeight = Math.round(width * 0.86);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          width,
          backgroundColor: isText ? tint : PAPER.page,
          zIndex: dragging ? 6 : 1,
          transform: [
            { translateX: pos.x },
            { translateY: pos.y },
            { rotate: index % 2 === 0 ? '-0.9deg' : '0.8deg' },
            { scale: dragging ? 1.04 : 1 },
          ],
        },
        dragging && styles.cardLifted,
      ]}
    >
      <View {...pan.panHandlers} style={[styles.cardHead, rtl && styles.rowRtl]}>
        <View style={[styles.cardAvatar, { backgroundColor: avatarTint }]}>
          <Text style={styles.cardAvatarText}>{initials(page.author_name)}</Text>
        </View>
        <Text style={[styles.cardName, rtl && styles.textRtl]} numberOfLines={1}>
          {page.author_name}
        </Text>
        {width > 96 ? <Text style={styles.cardTime}>{timeAgo(page.created_at, lang)}</Text> : null}
        {canDelete ? (
          <Pressable
            onPress={onDelete}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('basket.book.delete')}
            style={({ pressed }) => [styles.cardDelete, pressed && styles.pressed]}
          >
            <Trash2 size={12} color={PAPER.muted} />
          </Pressable>
        ) : null}
      </View>

      {(page.kind === 'photo' || page.kind === 'gif') && page.media ? (
        <View style={{ height: mediaHeight }}>
          <Image
            source={page.media.url}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={180}
          />
          {page.kind === 'gif' ? (
            <View style={styles.cardBadge}>
              <Text style={styles.cardBadgeText}>GIF</Text>
            </View>
          ) : null}
        </View>
      ) : page.kind === 'video' && page.media ? (
        <GiftMediaView media={{ type: 'video', url: page.media.url }} height={mediaHeight} />
      ) : page.kind === 'audio' && page.media ? (
        <View style={{ paddingHorizontal: pad, paddingBottom: pad }}>
          <ScrapVoice url={page.media.url} waveWidth={Math.max(36, width - pad * 2 - 40)} />
        </View>
      ) : (
        <Text
          style={[
            styles.cardText,
            {
              fontSize: between(17, 20, roomy),
              lineHeight: between(21, 24, roomy),
              paddingHorizontal: pad,
              paddingTop: 2,
              paddingBottom: pad,
            },
            rtl && styles.textRtl,
          ]}
        >
          {page.text}
        </Text>
      )}
    </Animated.View>
  );
}

/** A voice note as it sits on the page: a pink play button and a paper wave. */
function ScrapVoice({ url, waveWidth }: { url: string; waveWidth: number }) {
  const { t } = useTranslation();
  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => undefined);
  }, []);

  return (
    <View style={styles.voiceRow}>
      <Pressable
        onPress={() => (status.playing ? player.pause() : player.play())}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? t('send.pauseVoiceNote') : t('send.playVoiceNote')}
        style={({ pressed }) => [styles.voicePlay, pressed && styles.pressed]}
      >
        {status.playing ? (
          <Pause size={15} color="#FFFFFF" />
        ) : (
          <Play size={15} color="#FFFFFF" />
        )}
      </Pressable>
      <VoiceWaveform
        durationSeconds={status.duration || 4}
        width={waveWidth}
        height={24}
        barColor={PAPER.accent}
      />
    </View>
  );
}

const styles = themedStyles(() => ({
  pressed: { opacity: 0.8 },

  /* Closed book */
  coverPress: { alignSelf: 'center', alignItems: 'center', gap: 6, width: '100%' },
  coverPressed: { opacity: 0.9, transform: [{ rotate: '-1deg' }, { scale: 0.99 }] },
  coverStage: { position: 'relative' },
  pageEdge: {
    position: 'absolute',
    left: 3,
    right: 3,
    bottom: 0,
    top: 0,
    borderRadius: radii.sm,
    backgroundColor: PAPER.page,
  },
  pageEdgeBack: { transform: [{ rotate: '1.6deg' }], opacity: 0.9 },
  pageEdgeMid: { transform: [{ rotate: '0.7deg' }], opacity: 0.95 },
  coverFront: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.sm,
    backgroundColor: PAPER.page,
    transform: [{ rotate: '-1.4deg' }],
    shadowColor: PAPER.shadow,
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  coverClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: PAPER.page,
  },
  coverSpine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 12,
    backgroundColor: 'rgba(43, 38, 34, 0.16)',
  },
  // The spine, tape and label follow the binding: left edge in English, right
  // edge in Arabic.
  spineLeft: { left: 0 },
  spineRight: { right: 0 },
  coverLabelLtr: { left: 14 },
  coverLabelRtl: { right: 14 },
  textRtl: { textAlign: 'right', writingDirection: 'rtl' },
  ruleRtl: { alignSelf: 'flex-end' },
  coverLabel: {
    position: 'absolute',
    bottom: 14,
    maxWidth: '82%',
    backgroundColor: PAPER.tape,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 3,
    transform: [{ rotate: '-2deg' }],
  },
  coverLabelText: {
    fontFamily: fonts.handwritingBold,
    fontSize: 22,
    lineHeight: 26,
    color: PAPER.ink,
  },
  tape: {
    position: 'absolute',
    width: 62,
    height: 20,
    backgroundColor: PAPER.tape,
    borderRadius: 2,
  },
  tapeTop: { top: -6, right: 24, transform: [{ rotate: '8deg' }] },
  tapeBottom: { bottom: -7, left: 26, transform: [{ rotate: '-6deg' }] },
  flapTapeTop: { top: 8, right: 24, transform: [{ rotate: '8deg' }] },
  flapTapeBottom: { bottom: 8, left: 26, transform: [{ rotate: '-6deg' }] },
  coverHint: {
    fontFamily: fonts.handwritingBold,
    fontSize: 22,
    lineHeight: 26,
    color: PAPER.ink,
    marginTop: 6,
  },
  coverCount: {
    fontFamily: fonts.handwriting,
    fontSize: 16,
    lineHeight: 20,
    color: PAPER.muted,
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
  book: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    borderRadius: 10,
    backgroundColor: PAPER.page,
    overflow: 'hidden',
    shadowColor: PAPER.shadow,
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  spread: { flex: 1, flexDirection: 'row' },
  spreadRtl: { flexDirection: 'row-reverse' },
  // The width and side padding are set from the book's own width.
  leftPage: {
    backgroundColor: PAPER.left,
    paddingTop: 18,
    paddingBottom: 14,
    gap: 6,
  },
  leftTo: {
    fontFamily: fonts.handwriting,
    color: PAPER.ink,
  },
  leftWish: {
    fontFamily: fonts.handwritingBold,
    color: PAPER.ink,
  },
  leftRule: {
    height: 1,
    width: 46,
    backgroundColor: PAPER.muted,
    opacity: 0.4,
    marginVertical: 2,
  },
  leftFrom: {
    fontFamily: fonts.handwriting,
    color: PAPER.ink,
  },
  gutter: {
    width: 10,
    backgroundColor: PAPER.page,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: PAPER.rule,
  },
  rightPage: { flex: 1, backgroundColor: PAPER.page },
  pages: { flex: 1 },
  pageHint: {
    fontFamily: fonts.handwriting,
    fontSize: 15,
    lineHeight: 19,
    color: PAPER.muted,
    marginBottom: 10,
  },
  collage: { flexDirection: 'row', alignItems: 'flex-start' },
  collageRtl: { flexDirection: 'row-reverse' },
  column: { flexDirection: 'column' },
  emptyPage: { alignItems: 'center', gap: 6, paddingVertical: 28, paddingHorizontal: 8 },
  emptyText: {
    fontFamily: fonts.handwriting,
    fontSize: 19,
    lineHeight: 23,
    color: PAPER.muted,
    textAlign: 'center',
  },
  rowRtl: { flexDirection: 'row-reverse' },
  /* A note stuck on the page */
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(43, 38, 34, 0.05)',
  },
  cardLifted: {
    shadowColor: PAPER.shadow,
    shadowOpacity: 0.32,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 7, paddingTop: 6, paddingBottom: 5 },
  cardAvatar: {
    width: 20,
    height: 20,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardAvatarText: { fontFamily: fonts.bold, fontSize: 9, color: PAPER.ink },
  cardName: { flex: 1, fontFamily: fonts.semibold, fontSize: 11, color: PAPER.ink },
  cardTime: { fontFamily: fonts.regular, fontSize: 9, color: PAPER.muted },
  cardDelete: {
    width: 18,
    height: 18,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { fontFamily: fonts.handwriting, color: PAPER.ink },
  cardBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    backgroundColor: 'rgba(43, 38, 34, 0.82)',
  },
  cardBadgeText: { fontFamily: fonts.bold, fontSize: 8, color: '#FFFFFF', letterSpacing: 0.4 },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 2 },
  voicePlay: {
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PAPER.accent,
  },
  flap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: PAPER.page,
    backfaceVisibility: 'hidden',
    overflow: 'hidden',
  },
  flapSpine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 14,
    backgroundColor: 'rgba(43, 38, 34, 0.16)',
  },
  close: {
    position: 'absolute',
    top: 10,
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 252, 245, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  closeLtr: { right: 10 },
  closeRtl: { left: 10 },
  /* The writing pad, opened from the pencil on the page */
  composerCard: {
    position: 'absolute',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PAPER.rule,
    backgroundColor: '#FFFDF8',
    padding: 10,
    gap: 8,
    shadowColor: PAPER.shadow,
    shadowOpacity: 0.9,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  composerHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  composerTitle: {
    flex: 1,
    fontFamily: fonts.handwritingBold,
    fontSize: 18,
    lineHeight: 21,
    color: PAPER.ink,
  },
  composerClose: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PAPER.rule,
  },
  composerFoot: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  composeCta: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: radii.pill,
    backgroundColor: PAPER.ink,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PAPER.shadow,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  composeCtaLtr: { right: 0 },
  composeCtaRtl: { left: 0 },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    padding: 6,
  },
  attachmentThumb: { width: 28, height: 28, borderRadius: 6 },
  attachmentLabel: { flex: 1, fontFamily: fonts.semibold, fontSize: fontSizes.xs, color: PAPER.ink },
  attachmentRemove: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PAPER.rule,
  },
  recordingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordingLabel: {
    fontFamily: fonts.handwriting,
    fontSize: 18,
    lineHeight: 22,
    color: PAPER.muted,
  },
  error: { fontFamily: fonts.semibold, fontSize: fontSizes.xs, color: '#C6363C' },
  input: {
    minHeight: 42,
    maxHeight: 96,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: fonts.handwriting,
    color: PAPER.ink,
    textAlignVertical: 'top',
  },
  inputRtl: { textAlign: 'right', writingDirection: 'rtl' },
  send: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    backgroundColor: PAPER.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.35 },
  tools: { flex: 1, flexDirection: 'row', gap: 6 },
  tool: {
    flex: 1,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolActive: { backgroundColor: PAPER.ink },
  closedNote: { padding: 10, borderTopWidth: 1, borderStyle: 'dashed', borderColor: PAPER.rule },
  closedNoteText: {
    fontFamily: fonts.handwriting,
    fontSize: 18,
    lineHeight: 22,
    color: PAPER.muted,
  },
}));
