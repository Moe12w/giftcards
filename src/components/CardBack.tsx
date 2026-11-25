// src/components/CardBack.tsx
// The beige, paper-textured back of a gift card. Everything the sender wants
// to say lives here: a note, a voice note with a drawn waveform, and any
// photos, GIFs or videos. Used by CardStudio and reusable by other card flows.
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useTranslation } from 'react-i18next';

import { useThemeRefresh } from '../lib/theme';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '../theme';
import { Glyph } from './Glyph';
import { TextField } from './TextField';
import { VoiceWaveform } from './VoiceWaveform';

export interface CardBackItem {
  id: string;
  type: 'photo' | 'gif' | 'video' | 'audio';
  uri: string;
  durationMs?: number;
}

interface CardBackProps {
  message: string;
  onMessageChange: (value: string) => void;
  items: CardBackItem[];
  onItemsChange: (items: CardBackItem[]) => void;
  compact?: boolean;
}

function itemId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** A pen-style voice note: drawn waveform, play/pause and elapsed time. */
function DrawnVoiceNote({ item }: { item: CardBackItem }) {
  const player = useAudioPlayer(item.uri);
  const status = useAudioPlayerStatus(player);
  const seconds = (item.durationMs ?? 0) / 1000;
  return (
    <View style={styles.voiceNote}>
      <Pressable
        onPress={() => (status.playing ? player.pause() : player.play())}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause voice note' : 'Play voice note'}
        style={({ pressed }) => [styles.play, pressed && styles.pressed]}
      >
        <Glyph name={status.playing ? 'pause' : 'play'} size={18} color={colors.textOnInk} />
      </Pressable>
      <View style={styles.voiceBody}>
        <VoiceWaveform durationSeconds={seconds || 4} width={150} height={28} />
        <Text style={styles.voiceTime}>
          {formatTime(status.currentTime)} / {formatTime(status.duration || seconds)}
        </Text>
      </View>
    </View>
  );
}

export function CardBack({ message, onMessageChange, items, onItemsChange, compact = false }: CardBackProps) {
  useThemeRefresh();
  const { t } = useTranslation();
  const [error, setError] = React.useState<string | null>(null);
  const [recording, setRecording] = React.useState(false);
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'document' });
  const recorderState = useAudioRecorderState(recorder);

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
        allowsEditing: false,
        quality: kind === 'gif' ? 1 : 0.8,
        videoMaxDuration: 60,
      });
      const asset = result.canceled ? null : result.assets?.[0] ?? null;
      if (!asset) return;
      onItemsChange([
        ...items,
        {
          id: itemId(),
          type: kind,
          uri: asset.uri,
          ...(kind === 'video' ? { durationMs: asset.duration ?? undefined } : {}),
        },
      ]);
    } catch (pickError) {
      console.error('[card] media picker failed', pickError);
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
          onItemsChange([
            ...items,
            {
              id: itemId(),
              type: 'audio',
              uri: recorder.uri,
              durationMs: Math.round((recorderState.durationMillis ?? 0)),
            },
          ]);
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
      console.error('[card] recording failed', recordError);
      setRecording(false);
      setError(t('send.voiceFailed'));
    }
  }

  return (
    <View style={styles.back}>
      <View style={styles.paper}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.heading}>{t('cardBack.heading')}</Text>
          <TextField
            label={t('cardBack.messageLabel')}
            value={message}
            onChangeText={onMessageChange}
            multiline
            placeholder={t('cardBack.messagePlaceholder')}
            style={styles.messageField}
          />

          {items.map((item) => (
            <View key={item.id} style={styles.item}>
              {item.type === 'audio' ? (
                <DrawnVoiceNote item={item} />
              ) : item.type === 'video' ? (
                <View style={styles.mediaThumb}>
                  <Glyph name="video" size={22} color={colors.textOnInk} />
                  <Text style={styles.mediaLabel}>{t('cardBack.video')}</Text>
                  <Pressable
                    onPress={() => onItemsChange(items.filter((entry) => entry.id !== item.id))}
                    accessibilityRole="button"
                    accessibilityLabel={t('send.removeMedia')}
                    style={styles.remove}
                  >
                    <Glyph name="trash" size={16} color={colors.textOnInk} />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.mediaThumb}>
                  <Image source={item.uri} style={styles.thumbImage} contentFit="cover" />
                  <Pressable
                    onPress={() => onItemsChange(items.filter((entry) => entry.id !== item.id))}
                    accessibilityRole="button"
                    accessibilityLabel={t('send.removeMedia')}
                    style={styles.remove}
                  >
                    <Glyph name="trash" size={16} color={colors.textOnInk} />
                  </Pressable>
                </View>
              )}
            </View>
          ))}

          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          {recording ? (
            <View style={styles.recording}>
              <VoiceWaveform liveLevel={0.5} durationSeconds={Math.max(1, recorderState.durationMillis / 1000)} width={140} height={22} />
              <Text style={styles.recordingLabel}>{t('send.recording')}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.tools}>
          <Pressable onPress={() => pick('photo')} accessibilityRole="button" accessibilityLabel={t('send.addPhoto')} style={({ pressed }) => [styles.tool, pressed && styles.pressed]}>
            <Glyph name="camera" size={20} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => pick('gif')} accessibilityRole="button" accessibilityLabel={t('send.addGif')} style={({ pressed }) => [styles.tool, pressed && styles.pressed]}>
            <Glyph name="image" size={20} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => pick('video')} accessibilityRole="button" accessibilityLabel={t('send.addVideo')} style={({ pressed }) => [styles.tool, pressed && styles.pressed]}>
            <Glyph name="video" size={20} color={colors.text} />
          </Pressable>
          <Pressable onPress={toggleRecording} accessibilityRole="button" accessibilityLabel={recording ? t('send.stopRecording') : t('send.addVoiceNote')} style={({ pressed }) => [styles.tool, recording && styles.toolActive, pressed && styles.pressed]}>
            <Glyph name="mic" size={20} color={colors.text} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  back: { flex: 1, width: '100%', backgroundColor: '#E8DCC3', borderRadius: radii.lg, overflow: 'hidden' },
  paper: {
    flex: 1,
    margin: 6,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: '#C9B896',
    backgroundColor: '#F3E9D2',
  },
  scroll: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  heading: { fontFamily: fonts.extrabold, fontSize: fontSizes.lg, color: '#6B5535', textAlign: 'center' },
  messageField: { minHeight: 80 },
  item: { marginTop: spacing.xs },
  mediaThumb: {
    height: 90,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: '#C9B896',
    backgroundColor: '#E8DCC3',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  mediaLabel: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: '#6B5535' },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: '#6B5535',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  play: { width: 36, height: 36, borderRadius: radii.pill, backgroundColor: '#6B5535', alignItems: 'center', justifyContent: 'center' },
  voiceBody: { flex: 1, gap: 2 },
  voiceTime: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: '#8A6F45' },
  recording: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  recordingLabel: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: '#8A6F45' },
  error: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.danger, textAlign: 'center' },
  tools: { flexDirection: 'row', justifyContent: 'space-evenly', padding: spacing.sm, borderTopWidth: 2, borderTopColor: '#C9B896' },
  tool: { width: 44, height: 44, borderRadius: radii.pill, borderWidth: 2, borderColor: '#C9B896', backgroundColor: '#F3E9D2', alignItems: 'center', justifyContent: 'center' },
  toolActive: { backgroundColor: colors.tealTint, borderColor: colors.tealDark },
  pressed: { opacity: 0.8 },
}));
