import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAuthUrl } from './auth-link';

const mocks = vi.hoisted(() => ({
  setSession: vi.fn(async () => ({ error: null })),
  exchangeCodeForSession: vi.fn(async () => ({ error: null })),
}));

vi.mock('./supabase', () => ({
  getSupabase: () => ({
    auth: {
      setSession: mocks.setSession,
      exchangeCodeForSession: mocks.exchangeCodeForSession,
    },
  }),
}));

vi.mock('expo-linking', () => ({
  createURL: (path: string) => `tazella://${path.replace(/^\//, '')}`,
}));

describe('handleAuthUrl recovery link validation', () => {
  beforeEach(() => {
    mocks.setSession.mockClear();
    mocks.exchangeCodeForSession.mockClear();
  });

  it('rejects a crafted host that merely contains reset-password', async () => {
    const accepted = await handleAuthUrl(
      'tazella://reset-password.attacker.tld/cb#access_token=attacker&refresh_token=attacker',
    );
    expect(accepted).toBe(false);
    expect(mocks.setSession).not.toHaveBeenCalled();
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('accepts the app recovery link and installs its tokens', async () => {
    const accepted = await handleAuthUrl(
      'tazella://reset-password#access_token=good&refresh_token=good',
    );
    expect(accepted).toBe(true);
    expect(mocks.setSession).toHaveBeenCalledWith({
      access_token: 'good',
      refresh_token: 'good',
    });
  });

  it('does not exchange a code arriving on a foreign host', async () => {
    const accepted = await handleAuthUrl('tazella://reset-password.evil/cb?code=attacker');
    expect(accepted).toBe(false);
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
