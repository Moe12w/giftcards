import { beforeEach, describe, expect, it, vi } from 'vitest';

import { claimGift } from './claim';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('./supabase', () => ({
  getSupabase: () => ({ rpc: mocks.rpc }),
}));

vi.mock('./env', () => ({
  hasSupabaseConfig: true,
  env: { supabaseUrl: 'https://project.supabase.co', supabaseAnonKey: 'test' },
}));

describe('claimGift failure contract', () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
  });

  it('throws when the claim RPC fails so screens cannot navigate to success', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'already claimed' } });
    await expect(claimGift('token')).rejects.toThrow('already claimed');
  });

  it('returns the voucher id on a successful claim', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: 'voucher-1', error: null });
    await expect(claimGift('token')).resolves.toBe('voucher-1');
  });

  it('does not swallow an RPC error into a false success value', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'rate limited' } });
    const result = await claimGift('token').catch((error: Error) => error.message);
    expect(result).toBe('rate limited');
  });
});
