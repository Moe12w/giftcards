// src/lib/theme.tsx
// Light/dark theme state for the app.
//
// The palette lives in src/theme.ts. This provider owns which palette is
// active, remembers the choice between launches, and re-renders whatever uses
// `useTheme` when the switch changes.
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { darkColors, lightColors, setActivePalette, type Palette } from '@/src/theme';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'giftly.themeMode';

interface ThemeValue {
  mode: ThemeMode;
  isDark: boolean;
  colors: Palette;
  /** False until the saved choice has been read, so the app can wait before painting. */
  ready: boolean;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeValue>({
  mode: 'light',
  isDark: false,
  colors: lightColors,
  ready: false,
  setMode: () => undefined,
  toggle: () => undefined,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [ready, setReady] = useState(false);

  const apply = useCallback((next: ThemeMode) => {
    setActivePalette(next === 'dark' ? darkColors : lightColors);
    setModeState(next);
  }, []);

  // Restore the saved choice before the first screen paints.
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (active && (saved === 'dark' || saved === 'light')) apply(saved);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [apply]);

  const setMode = useCallback(
    (next: ThemeMode) => {
      apply(next);
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
    },
    [apply],
  );

  const toggle = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const value = useMemo<ThemeValue>(
    () => ({
      mode,
      isDark: mode === 'dark',
      colors: mode === 'dark' ? darkColors : lightColors,
      ready,
      setMode,
      toggle,
    }),
    [mode, ready, setMode, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The active theme, and the controls to change it. */
export function useTheme() {
  return useContext(ThemeContext);
}

/** Just the active palette, for components that only need colours. */
export function useThemeColors() {
  return useContext(ThemeContext).colors;
}

/**
 * Subscribes a screen to theme changes without using the values directly.
 *
 * Screens read their colours through the live palette (see src/theme.ts), so
 * they only need to re-render once when the switch flips.
 */
export function useThemeRefresh() {
  useContext(ThemeContext);
}
