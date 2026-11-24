// src/lib/push.ts
// Registering a device for push notifications.
//
// Used to nudge a buyer on the day a scheduled gift comes due, so a gift that
// has to be sent by hand (WhatsApp, SMS or a link) does not sit unseen until
// they open the app. Best-effort: registration never blocks auth or the app,
// and it needs a development build plus an EAS project id to actually receive
// pushes in production.
//
// The system permission prompt is asked exactly once per install and a denial
// is permanent, so it is never raised from sign-in. `registerPushToken` only
// records a token when permission was already granted; `enablePushNotifications`
// is the one place that prompts, and it is called from the priming card on the
// notifications screen, where the person can see why it is being asked.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getSupabase } from './supabase';
import { hasSupabaseConfig } from './env';

const PUSH_PROMPT_KEY = 'tazilla.pushPrompt.answered';

export type PushPermission = 'granted' | 'denied' | 'undetermined';

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

/** Current permission without prompting. Treats any failure, or web, as denied. */
export async function getPushPermission(): Promise<PushPermission> {
  if (Platform.OS === 'web') return 'denied';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted' || status === 'undetermined' ? status : 'denied';
  } catch {
    return 'denied';
  }
}

/** True once the priming card has been answered (either way). */
export async function hasAnsweredPushPrompt(): Promise<boolean> {
  try {
    return Boolean(await AsyncStorage.getItem(PUSH_PROMPT_KEY));
  } catch {
    // If storage is unavailable, stay quiet rather than nagging every visit.
    return true;
  }
}

export async function markPushPromptAnswered(): Promise<void> {
  try {
    await AsyncStorage.setItem(PUSH_PROMPT_KEY, '1');
  } catch {
    // Non-fatal: the card may show once more.
  }
}

/**
 * The EAS project id, or undefined while the app is still unlinked. `app.json`
 * ships a placeholder UUID until `eas init` runs; asking Expo for a push token
 * with it fails every time, so it is treated as "not configured" instead.
 */
function easProjectId(): string | undefined {
  const value = Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof value !== 'string' || !value.trim()) return undefined;
  // The placeholder shipped in app.json until `eas init` links the project.
  return value.toLowerCase() === '00000000-0000-0000-0000-000000000000' ? undefined : value;
}

async function savePushToken(userId: string): Promise<void> {
  if (!hasSupabaseConfig) return;
  const projectId = easProjectId();
  // Without a linked EAS project there is no token to obtain.
  if (!projectId) return;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData?.data;
    if (!token) return;

    await getSupabase()
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          token,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token' },
      );
  } catch {
    // Push is optional; never block auth or the app.
  }
}

/**
 * Save this device's push token. Never prompts, so it is safe to call on sign-in:
 * it does nothing until the person has granted permission from the priming card.
 */
export async function registerPushToken(userId: string): Promise<void> {
  if ((await getPushPermission()) === 'granted') await savePushToken(userId);
}

/**
 * The priming flow's "turn on" action: raise the system prompt if it has not
 * been answered, and register the device only if permission is granted. Returns
 * whether notifications ended up enabled.
 */
export async function enablePushNotifications(userId: string): Promise<boolean> {
  if (!hasSupabaseConfig) return false;
  try {
    const current = await getPushPermission();
    const status =
      current === 'undetermined'
        ? (await Notifications.requestPermissionsAsync()).status
        : current;
    if (status !== 'granted') return false;
    await savePushToken(userId);
    return true;
  } catch {
    return false;
  } finally {
    await markPushPromptAnswered();
  }
}
