// src/i18n/index.ts
// i18next setup for English and Arabic, with device-locale detection.
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n, {
  changeLanguage,
  init as initI18nextInstance,
  use as applyI18nextPlugin,
} from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';

import en from './en.json';
import ar from './ar.json';

export const SUPPORTED_LANGUAGES = ['en', 'ar'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/** The customer's explicit choice, so it survives a reload. */
export const LANGUAGE_KEY = 'giftly.language';

async function detectLanguage(): Promise<Language> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (stored === 'ar' || stored === 'en') return stored;
  } catch {
    // Storage is best-effort; fall back to the device locale.
  }
  const device = getLocales()[0];
  const code = device?.languageCode?.toLowerCase();
  return code === 'ar' ? 'ar' : 'en';
}

/** Arabic needs right-to-left layout. */
export function isRTL(language: Language): boolean {
  return language === 'ar';
}

// Note: React Native's I18nManager RTL flip is applied at the native level and
// may require an app reload to take effect. We still set it so fresh installs
// launched in Arabic render correctly.
I18nManager.allowRTL(true);

export async function initI18n(): Promise<typeof i18n> {
  if (i18n.isInitialized) return i18n;

  const language = await detectLanguage();
  // Fresh installs launched in Arabic should start with an RTL layout.
  I18nManager.forceRTL(isRTL(language));

  applyI18nextPlugin(initReactI18next);
  await initI18nextInstance({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
    },
    lng: language,
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LANGUAGES],
    interpolation: { escapeValue: false },
    returnNull: false,
  });

  return i18n;
}

export async function setLanguage(language: Language): Promise<void> {
  await changeLanguage(language);
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // Non-fatal: the language still applies for this session.
  }
  // The layout direction is applied natively; a reload may be required on
  // Android/iOS for the change to take full effect.
  I18nManager.forceRTL(isRTL(language));
}

export default i18n;
