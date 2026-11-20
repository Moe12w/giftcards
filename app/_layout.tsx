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

import { AuthProvider, useAuth } from '@/src/lib/auth';
import { hydrateCache } from '@/src/lib/cache';
import { startCatalogBootstrap, warmProfile } from '@/src/lib/bootstrap';
import { CardProvider } from '@/src/lib/cards';
import { perfMark } from '@/src/lib/perf';
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
      <AuthProvider>
        <AppShell loaded={loaded} i18nReady={i18nReady} />
      </AuthProvider>
    </ThemeProvider>
  );
}

/**
 * The app itself. It lives under the theme provider so the navigation
 * background, the status bar and every screen follow the theme switch.
 */
function AppShell({ loaded, i18nReady }: { loaded: boolean; i18nReady: boolean }) {
  const { isDark, ready } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const [cacheReady, setCacheReady] = useState(false);
  const [authTimedOut, setAuthTimedOut] = useState(false);
  const authReady = !authLoading || authTimedOut;

  // Disk hydration and session restore are the only things worth holding the
  // splash for. Both have a hard ceiling so an offline or very slow device
  // still reaches the app; the screens themselves have skeletons/cache reads.
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => active && setCacheReady(true), 1_500);
    hydrateCache().finally(() => {
      if (active) setCacheReady(true);
    });
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!authLoading) return;
    const timer = setTimeout(() => setAuthTimedOut(true), 2_500);
    return () => clearTimeout(timer);
  }, [authLoading]);

  // Start warming the catalog as soon as the persisted copy is in memory, but
  // never let the network decide when the branded splash disappears.
  useEffect(() => {
    if (!cacheReady) return;
    void startCatalogBootstrap();
  }, [cacheReady]);

  useEffect(() => {
    if (!cacheReady || !user?.id) return;
    void warmProfile(user.id);
  }, [cacheReady, user?.id]);

  useEffect(() => {
    if (loaded && i18nReady && ready && cacheReady && authReady) {
      perfMark('splash:hide');
      SplashScreen.hideAsync();
    }
  }, [loaded, i18nReady, ready, cacheReady, authReady]);

  if (!loaded || !i18nReady || !ready || !cacheReady || !authReady) {
    return null;
  }

  return (
    <CardProvider key={user?.id ?? 'anon'}>
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
  );
}
