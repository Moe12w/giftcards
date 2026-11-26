// src/components/CardStudio.tsx
// The card builder, in the app's own visual language. On the Create a gift
// page it is a normal app card ("Make it personal"). Tapping Choose an
// envelope opens the chooser; picking one slides that envelope to the right and
// reveals the paper carousel behind it (note paper + one card per attachment),
// with a dashed skeleton slot waiting for the next paper.
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { coverLabel, fetchGiftCovers, GIFT_COVERS, resolveCover, type GiftCover } from '../lib/gift-covers';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '../theme';
import { CardBack, type CardBackAttachment, type CardBackItem } from './CardBack';
import { CoverCard } from './CoverCard';
import { GifSheet } from './GifSheet';
import { Glyph } from './Glyph';
import { TextField } from './TextField';
import { VoiceNoteSheet } from './VoiceNoteSheet';
import * as ImagePicker from 'expo-image-picker';

interface CardStudioProps {
  coverId: string;
  onCoverChange: (coverId: string) => void;
  message: string;
  onMessageChange: (value: string) => void;
  items: CardBackItem[];
  onItemsChange: (items: CardBackItem[]) => void;
  mainAttachments?: CardBackAttachment[];
  onMainAttachmentsChange?: (attachments: CardBackAttachment[]) => void;
  onDone?: () => void;
  title?: string;
  logoUrl?: string | null;
  meta?: string;
  subtitle?: string;
}

type Phase = 'hidden' | 'chooser' | 'maker';
type Sheet = 'none' | 'gif' | 'voice';

/** The app's standard pastel blobs, reused inside the takeover. */
function Blobs() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.blobLilac} />
      <View style={styles.blobMint} />
      <View style={styles.blobRing} />
    </View>
  );
}

/** A neat, purpose-built illustration: a note peeking out of an envelope. */
function StudioArt() {
  return (
    <View style={styles.art} pointerEvents="none">
      <View style={styles.artNote}>
        <View style={styles.artNoteLine} />
        <View style={[styles.artNoteLine, styles.artNoteLineShort]} />
        <View style={styles.artHeart}><Glyph name="pen" size={13} color={colors.textOnPastel} /></View>
      </View>
      <View style={styles.artEnvelope}>
        <View style={styles.artFlap} />
        <View style={styles.artSeal}><Glyph name="star" size={13} color={colors.textOnPastel} /></View>
      </View>
    </View>
  );
}

export function CardStudio({
  coverId,
  onCoverChange,
  message,
  onMessageChange,
  items,
  onItemsChange,
  mainAttachments = [],
  onMainAttachmentsChange,
  onDone,
  title,
  logoUrl,
  meta,
  subtitle,
}: CardStudioProps) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const [phase, setPhase] = useState<Phase>('hidden');
  const [sheet, setSheet] = useState<Sheet>('none');
  const [quickNote, setQuickNote] = useState(false);
  const [covers, setCovers] = useState<GiftCover[]>(GIFT_COVERS);
  const [activeItem, setActiveItem] = useState<CardBackItem | null>(null);
  const active = useRef(true);

  // 0 = chooser visible, 1 = maker visible.
  const focus = useSharedValue(0);

  useEffect(() => {
    active.current = true;
    fetchGiftCovers().then((list) => active.current && setCovers(list));
    return () => {
      active.current = false;
    };
  }, []);

  function open() {
    setPhase('chooser');
    setSheet('none');
    focus.value = 0;
  }

  function close() {
    setSheet('none');
    setPhase('hidden');
  }

  function choose(id: string) {
    onCoverChange(id);
    focus.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) });
    setPhase('maker');
  }

  function chooseAgain() {
    focus.value = withTiming(0, { duration: 340, easing: Easing.out(Easing.cubic) });
    setPhase('chooser');
  }

  function addAttachmentToNote(noteId: string, attachment: CardBackAttachment) {
    if (noteId === '__main__') {
      onMainAttachmentsChange?.([...mainAttachments, attachment]);
      return;
    }
    onItemsChange(items.map((item) => item.id === noteId ? { ...item, attachments: [...(item.attachments ?? []), attachment] } : item));
  }

  function noteTargets(): { id: string; label: string }[] {
    const targets = [{ id: '__main__', label: t('cardBack.messageCard') }];
    items.forEach((item, index) => {
      if (item.type === 'note') targets.push({ id: item.id, label: `${t('cardBack.messageCard')} ${index + 2}` });
    });
    return targets;
  }

  function addMedia(kind: 'photo' | 'gif' | 'video' | 'audio', uri: string, durationMs?: number) {
    const attachment: CardBackAttachment = { id: `${Date.now()}`, type: kind, uri, durationMs };
    if (activeItem?.type === 'note') {
      addAttachmentToNote(activeItem.id, attachment);
      return;
    }
    if (kind === 'audio') {
      const targets = noteTargets();
      if (targets.length === 1) {
        addAttachmentToNote('__main__', attachment);
        return;
      }
      Alert.alert(t('send.addVoiceNote'), undefined, [
        ...targets.slice(0, 3).map((target) => ({ text: target.label, onPress: () => addAttachmentToNote(target.id, attachment) })),
        { text: t('cardBack.addNote'), onPress: () => onItemsChange([...items, { id: `${Date.now()}-n`, type: 'note', text: '', attachments: [attachment] }]) },
        { text: t('common.cancel'), style: 'cancel' as const },
      ]);
      return;
    }
    onItemsChange([...items, { id: `${Date.now()}`, type: kind, uri, ...(kind === 'video' ? { durationMs } : {}) }]);
  }

  async function pick(kind: 'photo' | 'video') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === 'video' ? ['videos'] : ['images'],
      allowsEditing: false,
      quality: 0.8,
      videoMaxDuration: 60,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset) return;
    addMedia(kind, asset.uri, kind === 'video' ? asset.duration ?? undefined : undefined);
  }

  const selected = resolveCover(coverId, covers);
  const selectedName = coverLabel(selected, t);

  const chooserStyle = useAnimatedStyle(() => ({ opacity: 1 - focus.value }));
  const makerStyle = useAnimatedStyle(() => ({ opacity: focus.value }));

  const gridTileWidth = Math.floor((width - spacing.gutter * 2 - spacing.sm) / 2);
  const gridTileHeight = Math.round(gridTileWidth * 1.5);
  const cardHeight = Math.min(height * 0.55, Math.round(width * 0.65 * 1.58));

  return (
    <>
      {/* Trigger — a normal app card, identical in style to the page's cards. */}
      <View style={styles.section}>
        <View style={styles.sectionInner}>
          <Text style={styles.heading}>{t('cardBack.heading')}</Text>
          <Text style={styles.subtitle}>{t('cardBack.subtitle')}</Text>

          <StudioArt />

          <Pressable
            onPress={open}
            accessibilityRole="button"
            accessibilityLabel={t('send.chooseCover')}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Glyph name="palette" size={18} color={colors.textOnPastel} />
            <Text style={styles.actionLabel}>{t('send.chooseCover')}</Text>
          </Pressable>

          <Pressable onPress={() => setQuickNote((value) => !value)} accessibilityRole="button">
            <Text style={styles.link}>{t('cardBack.quickNote')}</Text>
          </Pressable>

          {quickNote ? (
            <TextField
              value={message}
              onChangeText={onMessageChange}
              placeholder={t('cardBack.messagePlaceholder')}
              multiline
              numberOfLines={3}
            />
          ) : null}
        </View>
      </View>

      <Modal
        visible={phase !== 'hidden'}
        transparent
        presentationStyle="overFullScreen"
        animationType="none"
        onRequestClose={close}
      >
        <SafeAreaView style={styles.safe}>
          <View style={styles.overlay}>
            <Blobs />

            {/* CHOOSER — nine portrait envelopes. */}
            {phase === 'chooser' ? (
              <Animated.View style={[StyleSheet.absoluteFill, chooserStyle]}>
                <View style={styles.topBar}>
                  <Pressable onPress={close} accessibilityRole="button" style={styles.square}>
                    <Glyph name="arrowLeft" size={20} color={colors.ink} />
                  </Pressable>
                  <Text style={styles.topTitle}>{t('send.chooseCover')}</Text>
                  <Pressable onPress={() => choose(selected.id)} accessibilityRole="button" style={styles.next}>
                    <Text style={styles.nextLabel}>{t('send.next')}</Text>
                  </Pressable>
                </View>

                <ScrollView contentContainerStyle={styles.chooserContent} showsVerticalScrollIndicator={false}>
                  <View style={styles.grid}>
                    {covers.map((cover) => (
                      <Pressable
                        key={cover.id}
                        onPress={() => choose(cover.id)}
                        accessibilityRole="button"
                        accessibilityLabel={coverLabel(cover, t)}
                        style={({ pressed }) => [styles.gridTile, { width: gridTileWidth, height: gridTileHeight }, pressed && styles.pressed]}
                      >
                        <CoverCard cover={cover} name={coverLabel(cover, t)} height={gridTileHeight} compact />
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </Animated.View>
            ) : null}

            {/* MAKER — envelope is the first carousel page; it moves right on open. */}
            {phase === 'maker' ? (
              <Animated.View style={[StyleSheet.absoluteFill, makerStyle]}>
                <View style={styles.topBar}>
                  <Pressable onPress={close} accessibilityRole="button" style={styles.square}>
                    <Glyph name="x" size={20} color={colors.ink} />
                  </Pressable>
                  <Text style={styles.topTitle}>{t('cardBack.title')}</Text>
                  <Pressable onPress={chooseAgain} accessibilityRole="button" style={styles.square}>
                    <Glyph name="palette" size={18} color={colors.ink} />
                  </Pressable>
                </View>

                <KeyboardAvoidingView
                  style={styles.flex}
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                  <View style={styles.stage}>
                    <CardBack
                      message={message}
                      onMessageChange={onMessageChange}
                      items={items}
                      onItemsChange={onItemsChange}
                      pageWidth={width}
                      cardHeight={cardHeight}
                      onActiveItemChange={setActiveItem}
                      mainAttachments={mainAttachments}
                      onMainAttachmentsChange={onMainAttachmentsChange}
                      onAddPhoto={() => pick('photo')}
                      onAddGif={() => setSheet('gif')}
                      onAddVideo={() => pick('video')}
                      onAddVoice={() => setSheet('voice')}
                      onAddNote={() => onItemsChange([...items, { id: `${Date.now()}`, type: 'note', text: '' }])}
                      leadingPage={
                        <View style={{ width: '100%', height: cardHeight, borderRadius: radii.lg, borderWidth: 2, borderColor: colors.border, overflow: 'hidden', backgroundColor: colors.surface }}>
                          <CoverCard
                            cover={selected}
                            name={selectedName}
                            height={cardHeight}
                            framed={false}
                            title={title}
                            subtitle={subtitle}
                            logoUrl={logoUrl}
                            meta={meta}
                          />
                        </View>
                      }
                    />
                  </View>
                </KeyboardAvoidingView>

                {/* Actions. */}
                <View style={styles.bottomBar}>
                  <Pressable onPress={chooseAgain} accessibilityRole="button" style={styles.secondary}>
                    <Glyph name="arrowLeft" size={17} color={colors.text} />
                    <Text style={styles.secondaryLabel}>{t('cardBack.changeCover')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { onDone?.(); close(); }}
                    accessibilityRole="button"
                    style={styles.primary}
                  >
                    <Glyph name="check" size={18} color={colors.textOnPastel} />
                    <Text style={styles.primaryLabel}>{t('send.finish')}</Text>
                  </Pressable>
                </View>
              </Animated.View>
            ) : null}
          </View>
        </SafeAreaView>
      </Modal>

      <GifSheet
        visible={sheet === 'gif'}
        onClose={() => setSheet('none')}
        onPick={(uri) => {
          addMedia('gif', uri);
          setSheet('none');
        }}
      />
      <VoiceNoteSheet
        visible={sheet === 'voice'}
        onClose={() => setSheet('none')}
        onSave={(uri, durationMs) => {
          addMedia('audio', uri, durationMs);
          setSheet('none');
        }}
      />
    </>
  );
}

const styles = themedStyles(() => ({
  section: {
    borderRadius: radii.offer, borderWidth: 2, borderColor: colors.border,
    backgroundColor: colors.ink, paddingBottom: 5,
  },
  sectionInner: {
    borderRadius: radii.offer - 2, backgroundColor: colors.surface,
    padding: spacing.md + 2, gap: spacing.sm, overflow: 'hidden',
  },
  heading: { fontFamily: fonts.extrabold, fontSize: fontSizes.xl, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.text, opacity: 0.72, lineHeight: 19 },
  art: {
    height: 132, marginTop: spacing.sm, marginBottom: spacing.xs,
    alignItems: 'center', justifyContent: 'flex-end',
  },
  artNote: {
    width: 92, height: 84, borderWidth: 2, borderColor: colors.border,
    borderBottomWidth: 0, borderTopLeftRadius: radii.sm, borderTopRightRadius: radii.sm,
    backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingTop: spacing.md,
    transform: [{ rotate: '-5deg' }], zIndex: 1,
  },
  artNoteLine: { height: 3, borderRadius: 2, backgroundColor: colors.borderSoft, marginBottom: 8 },
  artNoteLineShort: { width: '62%' },
  artHeart: {
    position: 'absolute', right: spacing.sm, top: spacing.sm,
    width: 22, height: 22, borderRadius: radii.pill,
    backgroundColor: colors.pink, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  artEnvelope: {
    width: 138, height: 76, marginTop: -8, borderRadius: radii.sm,
    borderWidth: 2, borderColor: colors.border, backgroundColor: colors.lavender,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end',
  },
  artFlap: {
    position: 'absolute', top: -1, left: -1, right: -1, height: 46,
    borderBottomWidth: 2, borderBottomColor: colors.border,
    backgroundColor: colors.lavenderCard,
    transform: [{ rotate: '0deg' }],
  },
  artSeal: {
    width: 28, height: 28, borderRadius: radii.pill, marginBottom: spacing.sm,
    backgroundColor: colors.gold, borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', zIndex: 2,
  },
  action: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    minHeight: 50, borderRadius: radii.md, borderWidth: 2, borderColor: colors.border,
    backgroundColor: colors.lavender, paddingHorizontal: spacing.md,
  },
  actionLabel: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.textOnPastel },
  link: { alignSelf: 'center', fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.text, textDecorationLine: 'underline', paddingVertical: spacing.xs },
  pressed: { opacity: 0.85 },

  safe: { flex: 1, backgroundColor: colors.background },
  overlay: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  blobLilac: { position: 'absolute', top: -96, right: -84, width: 250, height: 250, borderRadius: 125, backgroundColor: colors.blobA },
  blobMint: { position: 'absolute', bottom: -40, left: -104, width: 230, height: 230, borderRadius: 115, backgroundColor: colors.blobB },
  blobRing: { position: 'absolute', top: 150, right: -48, width: 132, height: 132, borderRadius: 66, borderWidth: 2, borderColor: colors.blobRing },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.gutter, paddingVertical: spacing.sm },
  square: { width: 44, height: 44, borderRadius: radii.md, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.extrabold, fontSize: fontSizes.sm, letterSpacing: 1.4, color: colors.text, textTransform: 'uppercase' },
  next: { borderRadius: radii.md, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.lavender, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  nextLabel: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.textOnPastel },
  chooserContent: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm },
  gridTile: { borderRadius: radii.md, overflow: 'hidden' },

  stage: { flex: 1, paddingBottom: 46 },
  stageKeyboard: { paddingBottom: 0, justifyContent: 'flex-start', paddingTop: spacing.xs },

  bottomBar: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.gutter, paddingBottom: spacing.md },
  secondary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 48, borderRadius: radii.md, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface,
  },
  secondaryLabel: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.text },
  primary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 48, borderRadius: radii.md, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.lavender,
  },
  primaryLabel: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.textOnPastel },
}));
