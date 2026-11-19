// src/components/TextField.tsx
import React, { useState } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '../theme';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, style, onFocus, onBlur, ...inputProps }: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {/* The ring is a transparent 4px border that turns lavender on focus,
          mirroring the web inputs. It is always present, so nothing shifts. */}
      <View
        style={[
          styles.halo,
          focused && !error && styles.haloFocused,
          error ? styles.haloError : null,
        ]}
      >
        <TextInput
          placeholderTextColor={colors.textMuted}
          style={[styles.input, error ? styles.inputError : null, style]}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...inputProps}
        />
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = themedStyles(() => ({
  wrapper: { gap: spacing.sm, alignSelf: 'stretch' },
  label: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.text,
    marginBottom: spacing.xxs,
  },
  halo: {
    borderRadius: radii.md + 6,
    borderWidth: 4,
    borderColor: 'transparent',
  },
  haloFocused: { borderColor: colors.lavender },
  haloError: { borderColor: colors.pinkTint },
  input: {
    minHeight: 52,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text,
    backgroundColor: colors.surface,
    textAlign: 'auto',
  },
  inputError: { borderColor: colors.danger },
  error: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.danger },
  hint: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted },
}));
