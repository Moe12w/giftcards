// src/components/VoiceNoteSheet.tsx
// The voice-note screen from the reference: a green full-screen sheet with a
// white paper card, a language pill, a hand-drawn waveform, a timer, a red stop
// button and a delete button. Saving returns the recording to the card back.
import React, { useEffect } from 'react';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '../theme';
import { Glyph } from './Glyph';
import { VoiceWaveform } from './VoiceWaveform';

interface VoiceNoteSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (uri: string, durationMs: number) => void;
}

function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function VoiceNoteSheet({ visible, onClose, onSave }: VoiceNoteSheetProps) {
  const { t } = useTranslation();
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'document' });
  const state = useAudioRecorderState(recorder);
  const entering = useSharedValue(0);

  useEffect(() => {
    entering.value = visible
      ? withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) })
      : 0;
    if (visible) {
      (async () => {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        if (!permission.granted) return;
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        try {
          await recorder.prepareToRecordAsync();
          recorder.record();
        } catch (error) {
          console.error('[voice-sheet] record failed', error);
        }
      })();
    }
  }, [visible]);

  async function stop() {
    try {
      await recorder.stop();
    } catch {
      // Already stopped.
    }
  }

  function discard() {
    stop().catch(() => undefined);
    onClose();
  }

  function save() {
    stop().catch(() => undefined);
    if (recorder.uri) onSave(recorder.uri, Math.round(state.durationMillis ?? 0));
  }

  const style = useAnimatedStyle(() => ({
    opacity: entering.value,
    transform: [{ translateY: (1 - entering.value) * 40 }],
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={discard}>
      <Animated.View style={[styles.screen, style]}>
        <View style={styles.top}>
          <Pressable onPress={discard} accessibilityRole="button" style={styles.round}>
            <Glyph name="x" size={22} color={colors.ink} />
          </Pressable>
        </View>
        <Text style={styles.eyebrow}>{t('send.addVoiceNote')}</Text>

        <View style={styles.card}>
          <View style={styles.paper}>
            <Pressable accessibilityRole="button" style={styles.language}>
              <Text style={styles.languageLabel}>{t('cardBack.language')}</Text>
              <Glyph name="chevronDown" size={14} color={colors.text} />
            </Pressable>

            <VoiceWaveform
              durationSeconds={Math.max(1, (state.durationMillis ?? 1000) / 1000)}
              liveLevel={state.isRecording ? 0.35 : 0}
              width={200}
              height={44}
            />

            <View style={styles.timeRow}>
              <Text style={styles.dash}>—</Text>
              <Text style={styles.time}>{clock(state.durationMillis ?? 0)} / {clock(60_000)}</Text>
            </View>

            <Pressable
              onPress={state.isRecording ? stop : () => recorder.record()}
              accessibilityRole="button"
              accessibilityLabel={t('send.stopRecording')}
              style={styles.stop}
            >
              <View style={styles.stopInner} />
            </Pressable>
          </View>
          <Pressable onPress={discard} accessibilityRole="button" accessibilityLabel={t('send.removeMedia')} style={styles.delete}>
            <Glyph name="trash" size={18} color={colors.ink} />
          </Pressable>
        </View>

        <Pressable onPress={save} accessibilityRole="button" style={styles.finish}>
          <Glyph name="check" size={18} color={colors.textOnInk} />
          <Text style={styles.finishLabel}>{t('common.done')}</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = themedStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.coverEditor, paddingTop: spacing.lg, alignItems: 'center' },
  top: { alignSelf: 'stretch', paddingHorizontal: spacing.gutter },
  round: { width: 44, height: 44, borderRadius: radii.pill, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: fonts.extrabold, fontSize: fontSizes.sm, letterSpacing: 1.6, color: colors.onCover, textTransform: 'uppercase', marginVertical: spacing.md },
  card: { alignItems: 'center' },
  paper: {
    width: 280, minHeight: 340, borderRadius: radii.lg,
    borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface,
    padding: spacing.md, alignItems: 'center', justifyContent: 'space-between', gap: spacing.md,
  },
  language: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radii.pill, borderWidth: 2, borderColor: colors.borderSoft, paddingHorizontal: spacing.md, paddingVertical: 5 },
  languageLabel: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.text },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dash: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted },
  time: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted },
  stop: { width: 56, height: 56, borderRadius: radii.pill, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  stopInner: { width: 18, height: 18, borderRadius: 3, backgroundColor: colors.surface },
  delete: { width: 46, height: 46, borderRadius: radii.pill, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginTop: -20, zIndex: 2 },
  finish: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radii.md, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.danger, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, marginTop: spacing.xl },
  finishLabel: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.textOnInk },
}));
