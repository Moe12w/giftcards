// src/components/GiftMediaView.tsx
// Plays the media a sender attached to a card: video, animated GIF or a voice
// note. Photos and stickers are drawn by GiftCoverArt instead. One component so
// the editor, the preview and the recipient's claim screens behave the same.
import React, { useEffect } from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTranslation } from 'react-i18next';

import { useThemeRefresh } from '../lib/theme';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '../theme';
import { Glyph } from './Glyph';

export interface GiftMediaDescriptor {
  type: 'photo' | 'gif' | 'video' | 'audio';
  /** Local file URI while sending, remote URL once stored. */
  uri?: string;
  url?: string;
  durationMs?: number | null;
  mimeType?: string | null;
}

function sourceOf(media: GiftMediaDescriptor): string | null {
  return media.url ?? media.uri ?? null;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** A compact voice-note player with play/pause and elapsed time. */
function VoiceNotePlayer({ source }: { source: string }) {
  const { t } = useTranslation();
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => undefined);
  }, []);

  return (
    <Pressable
      onPress={() => (status.playing ? player.pause() : player.play())}
      accessibilityRole="button"
      accessibilityLabel={status.playing ? t('send.pauseVoiceNote') : t('send.playVoiceNote')}
      style={({ pressed }) => [styles.audio, pressed && styles.pressed]}
    >
      <View style={styles.audioIcon}>
        <Glyph name={status.playing ? 'pause' : 'play'} size={22} color={colors.textOnInk} />
      </View>
      <View style={styles.audioCopy}>
        <Text style={styles.audioTitle}>{t('send.voiceNote')}</Text>
        <Text style={styles.audioTime}>
          {formatDuration(status.currentTime)} / {formatDuration(status.duration || 0)}
        </Text>
      </View>
      <Glyph name="audioLines" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

/** An inline video player with native controls. */
function VideoAttachment({ source }: { source: string }) {
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = true;
  });
  return (
    <View style={styles.videoWrap}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls
        fullscreenOptions={{ enable: true }}
      />
    </View>
  );
}

export interface GiftMediaViewProps {
  media: GiftMediaDescriptor | null;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function GiftMediaView({ media, height = 200, style }: GiftMediaViewProps) {
  useThemeRefresh();
  const source = media ? sourceOf(media) : null;
  if (!media || !source) return null;

  if (media.type === 'audio') {
    return (
      <View style={[styles.container, { height: 72 }, style]}>
        <VoiceNotePlayer source={source} />
      </View>
    );
  }
  if (media.type === 'video') {
    return (
      <View style={[styles.container, { height }, style]}>
        <VideoAttachment source={source} />
      </View>
    );
  }
  if (media.type === 'gif') {
    return (
      <View style={[styles.container, { height }, style]}>
        <Image source={source} style={styles.gif} contentFit="cover" />
      </View>
    );
  }
  // Photos are rendered on the card by GiftCoverArt.
  return null;
}

const styles = themedStyles(() => ({
  container: { overflow: 'hidden', borderRadius: radii.lg },
  videoWrap: { flex: 1, backgroundColor: '#000000' },
  video: { width: '100%', height: '100%' },
  gif: { width: '100%', height: '100%' },
  audio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
    height: 72,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  audioIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  audioCopy: { flex: 1, gap: 2 },
  audioTitle: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.text },
  audioTime: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  pressed: { opacity: 0.85 },
}));
