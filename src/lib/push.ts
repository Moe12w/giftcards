// src/lib/push.ts
// Registering a device for push notifications.
//
// Used to nudge a buyer on the day a scheduled gift comes due, so a gift that
// has to be sent by hand (WhatsApp, SMS or a link) does not sit unseen until
// they open the app. Best-effort: registration never blocks auth or the app,
// and it needs a development build plus an EAS project id to actually receive
// pushes in production.
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getSupabase } from './supabase';
import { hasSupabaseConfig } from './env';

// Show the notification even while the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerPushToken(userId: string): Promise<void> {
  if (!hasSupabaseConfig) return;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const projectId = (Constants.expoConfig as { extra?: { eas?: { projectId?: string } } } | null)
      ?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenData?.data;
    if (!token) return;

    const platform =
      Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

    await getSupabase()
      .from('push_tokens')
      .upsert(
        { user_id: userId, token, platform, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,token' },
      );
  } catch {
    // Push is optional; never block auth or the app.
  }
}
