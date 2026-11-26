// src/components/CardBack.tsx
// Peeking carousel of paper cards. Center card is largest; neighbors peek
// smaller on the sides. Opens with envelope left, note center, skeleton right.
import React, { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import {
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '../theme';
import { Glyph } from './Glyph';
import { VoiceWaveform } from './VoiceWaveform';

export interface CardBackAttachment {
  id: string;
  type: 'photo' | 'gif' | 'video' | 'audio';
  uri?: string;
  url?: string;
  durationMs?: number;
}

export interface CardBackItem {
  id: string;
  type: 'note' | 'photo' | 'gif' | 'video' | 'audio';
  /** Media file URI on device / stored URL. Not used for note papers. */
  uri?: string;
  /** The sender's writing on a note paper. */
  text?: string;
  durationMs?: number;
  /** Media attached to a note paper. */
  attachments?: CardBackAttachment[];
}

interface CardBackProps {
  message: string;
  onMessageChange: (value: string) => void;
  items: CardBackItem[];
  onItemsChange: (items: CardBackItem[]) => void;
  /** Optional first page (e.g. the envelope cover). */
  leadingPage?: React.ReactNode;
  /** Page width; defaults to screen width. */
  pageWidth?: number;
  /** Card height used to size paper pages. */
  cardHeight?: number;
  /** Reports the currently centered page item, or null for envelope/skeleton. */
  onActiveItemChange?: (item: CardBackItem | null) => void;
  /** Attachments on the main message note paper. */
  mainAttachments?: CardBackAttachment[];
  onMainAttachmentsChange?: (attachments: CardBackAttachment[]) => void;
  onAddPhoto?: () => void;
  onAddGif?: () => void;
  onAddVideo?: () => void;
  onAddVoice?: () => void;
  onAddNote?: () => void;
}

function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function VoiceCard({ item }: { item: Pick<CardBackItem, 'uri' | 'durationMs'> }) {
  const player = useAudioPlayer(item.uri);
  const status = useAudioPlayerStatus(player);
  const duration = (item.durationMs ?? 0) / 1000;
  return (
    <View style={styles.voice}>
      <Pressable
        onPress={() => (status.playing ? player.pause() : player.play())}
        accessibilityRole="button"
        style={styles.voicePlay}
      >
        <Glyph name={status.playing ? 'pause' : 'play'} size={20} color={colors.textOnInk} />
      </Pressable>
      <View style={styles.voiceCopy}>
        <VoiceWaveform durationSeconds={duration || 3} width={130} height={30} />
        <Text style={styles.time}>
          {clock(status.currentTime * 1000)} / {clock(status.duration * 1000 || (item.durationMs ?? 0))}
        </Text>
      </View>
    </View>
  );
}

function NotePaper({
  value,
  onChange,
  onRemove,
  paperHeight,
  placeholder,
  removeLabel,
  attachments = [],
  onRemoveAttachment,
  showTools,
  onAddPhoto,
  onAddGif,
  onAddVideo,
  onAddVoice,
}: {
  value: string;
  onChange: (text: string) => void;
  onRemove?: () => void;
  paperHeight: number;
  placeholder: string;
  removeLabel: string;
  attachments?: CardBackAttachment[];
  onRemoveAttachment?: (id: string) => void;
  showTools?: boolean;
  onAddPhoto?: () => void;
  onAddGif?: () => void;
  onAddVideo?: () => void;
  onAddVoice?: () => void;
}) {
  const inputRef = useRef<any>(null);
  // Writing starts here (consistent so it doesn't jump when keyboard toggles).
  const topOffset = 76;
  const lineStep = 34;
  const hasAttachments = attachments.length > 0;
  // Ruled lines cover the whole paper (start near the top) so there's no
  // large empty white area; writing sits lower, over the lines.
  const lineStart = 24;
  const lineCount = Math.max(4, Math.floor((paperHeight - lineStart - 16) / lineStep));
  return (
    <Pressable
      onPress={() => {
        if (showTools) Keyboard.dismiss();
      }}
      style={[styles.notePaper, { height: paperHeight, paddingTop: topOffset }]}
    >
      <View pointerEvents="none" style={styles.paperTexture}>
        {Array.from({ length: lineCount }).map((_, i) => (
          <View key={i} style={[styles.ruledLine, { top: lineStart + i * lineStep }]} />
        ))}
      </View>
      {showTools ? (
        <View style={styles.noteTools}>
          {onAddPhoto ? <Pressable onPress={onAddPhoto} accessibilityRole="button" style={styles.noteToolBtn}><Glyph name="camera" size={15} color={colors.text} /></Pressable> : null}
          {onAddGif ? <Pressable onPress={onAddGif} accessibilityRole="button" style={styles.noteToolBtn}><Glyph name="image" size={15} color={colors.text} /></Pressable> : null}
          {onAddVideo ? <Pressable onPress={onAddVideo} accessibilityRole="button" style={styles.noteToolBtn}><Glyph name="video" size={15} color={colors.text} /></Pressable> : null}
          {onAddVoice ? <Pressable onPress={onAddVoice} accessibilityRole="button" style={styles.noteToolBtn}><Glyph name="mic" size={15} color={colors.text} /></Pressable> : null}
        </View>
      ) : null}
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={removeLabel}
          style={styles.noteRemove}
          hitSlop={8}
        >
          <Glyph name="trash" size={13} color={colors.textMuted} />
        </Pressable>
      ) : null}
      <TextInput
        ref={inputRef as any}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="rgba(90,70,50,0.35)"
        multiline
        scrollEnabled
        textAlignVertical="top"
        style={[styles.noteInput, hasAttachments && { flexGrow: 0, minHeight: 72, maxHeight: paperHeight * 0.34 }]}
      />
      {hasAttachments ? (
        <View style={styles.attachGrid}>
          {attachments.map((att) => (
            <View key={att.id} style={[styles.attachItem, att.type === 'audio' && styles.attachAudio]}>
              {att.type === 'audio' ? (
                <VoiceCard item={att} />
              ) : (
                <Image source={att.uri ?? att.url ?? ''} style={styles.attachImage} contentFit="cover" />
              )}
              {onRemoveAttachment ? (
                <Pressable
                  onPress={() => onRemoveAttachment(att.id)}
                  accessibilityRole="button"
                  accessibilityLabel={removeLabel}
                  style={styles.attachRemove}
                  hitSlop={6}
                >
                  <Glyph name="x" size={10} color={colors.textOnInk} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function PeekCard({
  index,
  scrollX,
  itemWidth,
  gap,
  children,
}: {
  index: number;
  scrollX: SharedValue<number>;
  itemWidth: number;
  gap: number;
  children: React.ReactNode;
}) {
  const snap = itemWidth + gap;
  const style = useAnimatedStyle(() => {
    const distance = Math.abs(scrollX.value - index * snap);
    const scale = interpolate(distance, [0, snap], [1, 0.75], Extrapolation.CLAMP);
    const opacity = interpolate(distance, [0, snap], [1, 0.5], Extrapolation.CLAMP);
    return { transform: [{ scale }], opacity };
  });
  return (
    <Animated.View style={[{ width: itemWidth, marginRight: gap }, style]}>
      {children}
    </Animated.View>
  );
}

export function CardBack({
  message,
  onMessageChange,
  items,
  onItemsChange,
  leadingPage,
  pageWidth,
  cardHeight,
  onActiveItemChange,
  mainAttachments = [],
  onMainAttachmentsChange,
  onAddPhoto,
  onAddGif,
  onAddVideo,
  onAddVoice,
  onAddNote,
}: CardBackProps) {
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const width = pageWidth ?? windowWidth;
  const itemWidth = Math.round(width * 0.65);
  const gap = -spacing.md;
  const snap = itemWidth + gap;
  const sidePad = Math.max(0, (width - itemWidth) / 2);
  const scroller = useRef<Animated.ScrollView>(null);
  const scrollX = useSharedValue(0);
  const initialPage = leadingPage ? 1 : 0;
  const [page, setPage] = useState(initialPage);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  function activeItemForPage(p: number): CardBackItem | null {
    const offset = leadingPage ? 1 : 0;
    if (p === offset) return { id: '__main__', type: 'note', text: message, attachments: mainAttachments };
    const itemIndex = p - offset - 1;
    if (itemIndex >= 0 && itemIndex < items.length) return items[itemIndex];
    return null;
  }

  // Land on the note paper when opened so envelope peeks left, skeleton right.
  useEffect(() => {
    const handle = setTimeout(() => {
      scroller.current?.scrollTo({ x: snap * initialPage, animated: true });
      setPage(initialPage);
      onActiveItemChange?.(activeItemForPage(initialPage));
    }, 60);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, initialPage]);

  function onMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / snap);
    setPage(next);
    onActiveItemChange?.(activeItemForPage(next));
  }

  function remove(item: CardBackItem) {
    onItemsChange(items.filter((entry) => entry.id !== item.id));
  }

  const paperHeight = cardHeight ?? Math.round(width * 1.05);

  const pages: React.ReactNode[] = [
    ...(leadingPage
      ? [<View key="leading" style={{ height: paperHeight }}>{leadingPage}</View>]
      : []),
    <NotePaper
      key="note"
      value={message}
      onChange={onMessageChange}
      paperHeight={paperHeight}
      placeholder={t('cardBack.messagePlaceholder')}
      removeLabel={t('send.removeMedia')}
      attachments={mainAttachments}
      onRemoveAttachment={(id) => onMainAttachmentsChange?.(mainAttachments.filter((a) => a.id !== id))}
      showTools={keyboardVisible && page === (leadingPage ? 1 : 0)}
      onAddPhoto={onAddPhoto}
      onAddGif={onAddGif}
      onAddVideo={onAddVideo}
      onAddVoice={onAddVoice}
    />,
    ...items.map((item, itemIndex) =>
      item.type === 'note'
        ? (
          <NotePaper
            key={item.id}
            value={item.text ?? ''}
            onChange={(text) => onItemsChange(items.map((entry) => (entry.id === item.id ? { ...entry, text } : entry)))}
            onRemove={() => remove(item)}
            paperHeight={paperHeight}
            placeholder={t('cardBack.messagePlaceholder')}
            removeLabel={t('send.removeMedia')}
            attachments={item.attachments}
            onRemoveAttachment={(id) => onItemsChange(items.map((entry) => (entry.id === item.id ? { ...entry, attachments: (entry.attachments ?? []).filter((a) => a.id !== id) } : entry)))}
            showTools={keyboardVisible && page === (leadingPage ? 1 : 0) + 1 + itemIndex}
            onAddPhoto={onAddPhoto}
            onAddGif={onAddGif}
            onAddVideo={onAddVideo}
            onAddVoice={onAddVoice}
          />
        )
        : (
          <View key={item.id} style={[styles.paper, { height: paperHeight }]}>
            <View style={styles.paperHead}>
              <View style={styles.paperIcon}>
                <Glyph
                  name={item.type === 'audio' ? 'mic' : item.type === 'video' ? 'video' : item.type === 'gif' ? 'image' : 'camera'}
                  size={14}
                  color={colors.textOnInk}
                />
              </View>
              <Text style={styles.paperLabel}>
                {item.type === 'audio' ? t('send.addVoiceNote') :
                 item.type === 'video' ? t('send.addVideo') :
                 item.type === 'gif' ? t('send.addGif') : t('send.addPhoto')}
              </Text>
              <Pressable onPress={() => remove(item)} accessibilityRole="button" accessibilityLabel={t('send.removeMedia')} style={styles.paperRemove}>
                <Glyph name="trash" size={13} color={colors.textOnInk} />
              </Pressable>
            </View>
            <View style={styles.paperBody}>
              {item.type === 'audio' ? (
                <VoiceCard item={item} />
              ) : (
                <Image source={item.uri ?? ''} style={styles.image} contentFit="cover" />
              )}
            </View>
          </View>
        ),
    ),
    <View key="skeleton" style={[styles.skeleton, { height: paperHeight }]}>
      <Pressable onPress={onAddNote} accessibilityRole="button" style={styles.skeletonAdd}>
        <Glyph name="circlePlus" size={28} color={colors.text} />
        <Text style={styles.skeletonAddLabel}>{t('cardBack.addNote')}</Text>
      </Pressable>
      <Text style={styles.skeletonText}>{t('cardBack.cardsInside')}</Text>
      <View style={styles.skeletonActions}>
        {onAddPhoto ? (
          <Pressable onPress={onAddPhoto} accessibilityRole="button" style={styles.skeletonBtn}>
            <Glyph name="camera" size={16} color={colors.text} />
            <Text style={styles.skeletonBtnLabel}>{t('send.addPhoto')}</Text>
          </Pressable>
        ) : null}
        {onAddGif ? (
          <Pressable onPress={onAddGif} accessibilityRole="button" style={styles.skeletonBtn}>
            <Glyph name="image" size={16} color={colors.text} />
            <Text style={styles.skeletonBtnLabel}>{t('send.addGif')}</Text>
          </Pressable>
        ) : null}
        {onAddVideo ? (
          <Pressable onPress={onAddVideo} accessibilityRole="button" style={styles.skeletonBtn}>
            <Glyph name="video" size={16} color={colors.text} />
            <Text style={styles.skeletonBtnLabel}>{t('send.addVideo')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>,
  ];

  return (
    <View style={styles.wrap}>
      <Animated.ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={snap}
        decelerationRate="fast"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: sidePad, alignItems: 'center' }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumEnd}
      >
        {pages.map((child, index) => (
          <PeekCard key={index} index={index} scrollX={scrollX} itemWidth={itemWidth} gap={gap}>
            {child}
          </PeekCard>
        ))}
      </Animated.ScrollView>
      <View style={styles.dots}>
        {pages.map((_, index) => (
          <View key={index} style={[styles.dot, index === page && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: { flex: 1, width: '100%' },
  skeleton: {
    width: '100%', borderRadius: radii.lg,
    borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border,
    backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },
  skeletonText: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.textMuted },
  skeletonAdd: { alignItems: 'center', gap: 6, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  skeletonAddLabel: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.text },
  skeletonActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.sm },
  skeletonBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  skeletonBtnLabel: { fontFamily: fonts.semibold, fontSize: fontSizes.xs, color: colors.text },
  paper: {
    width: '100%', borderRadius: radii.lg,
    borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface,
    paddingBottom: 4, overflow: 'hidden',
  },
  paperHead: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    padding: spacing.sm, borderBottomWidth: 2, borderBottomColor: colors.border, backgroundColor: colors.surfaceAlt,
  },
  paperIcon: { width: 26, height: 26, borderRadius: radii.pill, backgroundColor: colors.tealDark, alignItems: 'center', justifyContent: 'center' },
  paperLabel: { flex: 1, fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.text },
  paperRemove: { width: 26, height: 26, borderRadius: radii.pill, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  paperBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  notePaper: {
    width: '100%',
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  paperTexture: {
    ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const),
  },
  ruledLine: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    height: 1,
    backgroundColor: 'rgba(120, 100, 80, 0.12)',
  },
  noteRemove: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  noteTools: {
    position: 'absolute',
    top: spacing.sm,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    zIndex: 3,
  },
  noteToolBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteInput: {
    flex: 1,
    fontFamily: fonts.handwriting,
    fontSize: 28,
    lineHeight: 34,
    color: '#3A2E24',
    padding: 0,
    margin: 0,
  },
  attachGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: spacing.xs,
  },
  attachItem: {
    width: 64,
    height: 64,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  attachAudio: {
    width: '100%',
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  attachImage: { width: '100%', height: '100%' },
  attachRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: radii.pill,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%', borderRadius: radii.md },
  voice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  voicePlay: { width: 40, height: 40, borderRadius: radii.pill, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  voiceCopy: { gap: 4, flex: 1 },
  time: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderSoft },
  dotActive: { backgroundColor: colors.danger, width: 18 },
}));