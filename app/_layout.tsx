import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
  Figtree_900Black,
} from '@expo-google-fonts/figtree';

import { AuthProvider } from '@/src/lib/auth';
import { CardProvider } from '@/src/lib/cards';
import { initI18n } from '@/src/i18n';
import { ThemeProvider, useTheme } from '@/src/lib/theme';
import { colors } from '@/src/theme';

export { ErrorBoundary } from 'expo-router';

// Keep the splash screen up until fonts and translations are ready.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
    Figtree_900Black,
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    initI18n()
      .catch((err) => console.error('Failed to initialise i18n', err))
      .finally(() => setI18nReady(true));
  }, []);

  return (
    <ThemeProvider>
      <AppShell loaded={loaded} i18nReady={i18nReady} />
    </ThemeProvider>
  );
}

/**
 * The app itself. It lives under the theme provider so the navigation
 * background, the status bar and every screen follow the theme switch.
 */
function AppShell({ loaded, i18nReady }: { loaded: boolean; i18nReady: boolean }) {
  const { isDark, ready } = useTheme();

  useEffect(() => {
    if (loaded && i18nReady && ready) {
      SplashScreen.hideAsync();
    }
  }, [loaded, i18nReady, ready]);

  if (!loaded || !i18nReady || !ready) {
    return null;
  }

  return (
    <AuthProvider>
      <CardProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(customer)" />
          <Stack.Screen name="(admin)" />
        </Stack>
      </CardProvider>
    </AuthProvider>
  );
}
