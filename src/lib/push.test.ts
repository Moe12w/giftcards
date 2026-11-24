import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  enablePushNotifications,
  getPushPermission,
  hasAnsweredPushPrompt,
  registerPushToken,
} from './push';

// The push module talks to native Expo modules, so every dependency it touches
// is replaced with a spy. `Platform.OS` is a plain object so a test can flip it.
const mocks = vi.hoisted(() => ({
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  getExpoPushTokenAsync: vi.fn(),
  setNotificationHandler: vi.fn(),
  upsert: vi.fn(),
  getItem: vi.fn(),
  setItem: vi.fn(),
  platform: { OS: 'ios' as string },
  projectId: 'test-project',
}));

vi.mock('react-native', () => ({ Platform: mocks.platform }));

vi.mock('expo-notifications', () => ({
  setNotificationHandler: mocks.setNotificationHandler,
  getPermissionsAsync: mocks.getPermissionsAsync,
  requestPermissionsAsync: mocks.requestPermissionsAsync,
  getExpoPushTokenAsync: mocks.getExpoPushTokenAsync,
}));

vi.mock('expo-constants', () => ({
  default: {
    get expoConfig() {
      return { extra: { eas: { projectId: mocks.projectId } } };
    },
  },
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: mocks.getItem, setItem: mocks.setItem },
}));

vi.mock('./supabase', () => ({
  getSupabase: () => ({ from: () => ({ upsert: mocks.upsert }) }),
}));

vi.mock('./env', () => ({ hasSupabaseConfig: true }));

const TOKEN = 'ExponentPushToken[test-token]';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.platform.OS = 'ios';
  mocks.projectId = 'test-project';
  mocks.getItem.mockResolvedValue(null);
  mocks.setItem.mockResolvedValue(undefined);
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.getExpoPushTokenAsync.mockResolvedValue({ data: TOKEN });
});

describe('sign-in registration', () => {
  it('never asks for permission while the prompt is unanswered', async () => {
    mocks.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });

    await registerPushToken('user-1');

    expect(mocks.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mocks.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('never asks again after a denial', async () => {
    mocks.getPermissionsAsync.mockResolvedValue({ status: 'denied' });

    await registerPushToken('user-1');

    expect(mocks.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('saves the token when permission was already granted', async () => {
    mocks.getPermissionsAsync.mockResolvedValue({ status: 'granted' });

    await registerPushToken('user-1');

    expect(mocks.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.upsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        token: TOKEN,
        platform: 'ios',
        updated_at: expect.any(String),
      },
      { onConflict: 'user_id,token' },
    );
  });
});

describe('enablePushNotifications', () => {
  it('prompts once and registers when granted', async () => {
    mocks.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mocks.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });

    await expect(enablePushNotifications('user-1')).resolves.toBe(true);

    expect(mocks.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });

  it('does not register when the prompt is denied, and remembers the answer', async () => {
    mocks.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mocks.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });

    await expect(enablePushNotifications('user-1')).resolves.toBe(false);

    expect(mocks.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.setItem).toHaveBeenCalledWith('tazilla.pushPrompt.answered', '1');
  });

  it('does not prompt again when the OS already denied permission', async () => {
    mocks.getPermissionsAsync.mockResolvedValue({ status: 'denied' });

    await expect(enablePushNotifications('user-1')).resolves.toBe(false);

    expect(mocks.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('registers without prompting when permission is already granted', async () => {
    mocks.getPermissionsAsync.mockResolvedValue({ status: 'granted' });

    await expect(enablePushNotifications('user-1')).resolves.toBe(true);

    expect(mocks.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });

  it('skips token registration while the EAS project id is still the placeholder', async () => {
    mocks.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mocks.projectId = '00000000-0000-0000-0000-000000000000';

    await expect(enablePushNotifications('user-1')).resolves.toBe(true);

    // The OS permission is real, but there is no linked project to mint a token.
    expect(mocks.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});

describe('permission reads', () => {
  it('treats the web as denied so nothing is registered there', async () => {
    mocks.platform.OS = 'web';

    await expect(getPushPermission()).resolves.toBe('denied');
    expect(mocks.getPermissionsAsync).not.toHaveBeenCalled();
  });

  it('normalises unknown statuses to denied', async () => {
    mocks.getPermissionsAsync.mockResolvedValue({ status: 'provisional' });

    await expect(getPushPermission()).resolves.toBe('denied');
  });

  it('stays quiet when storage cannot be read', async () => {
    mocks.getItem.mockRejectedValue(new Error('storage unavailable'));

    await expect(hasAnsweredPushPrompt()).resolves.toBe(true);
  });
});
