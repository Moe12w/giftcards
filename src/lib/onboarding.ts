import AsyncStorage from '@react-native-async-storage/async-storage';

export const ONBOARDING_KEY = 'giftly.onboarding.seen';

export async function markOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
  } catch {
    // Non-fatal: onboarding may show again next launch.
  }
}
