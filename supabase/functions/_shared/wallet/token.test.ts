import { describe, expect, it } from 'vitest';

import {
  compactVoucherId,
  expandVoucherId,
  tokenIsValid,
  tokenVoucherId,
  voucherPassToken,
} from './token';

const SECRET = 'a'.repeat(48);
const VOUCHER_ID = '8a1f0c2e-1111-4a2b-9c3d-000000000001';

describe('pass authentication token', () => {
  it('round-trips the voucher id through the compact form', () => {
    expect(compactVoucherId(VOUCHER_ID)).toBe('8a1f0c2e11114a2b9c3d000000000001');
    expect(expandVoucherId(compactVoucherId(VOUCHER_ID))).toBe(VOUCHER_ID);
    expect(expandVoucherId('not-a-uuid')).toBeNull();
  });

  it('derives a stable, countable token', async () => {
    const token = await voucherPassToken(SECRET, VOUCHER_ID);
    expect(token).toBe(await voucherPassToken(SECRET, VOUCHER_ID));
    expect(token.split('.')[0]).toHaveLength(32);
    expect(tokenVoucherId(token)).toBe(VOUCHER_ID);
  });

  it('refuses a token minted with another secret or for another card', async () => {
    const token = await voucherPassToken(SECRET, VOUCHER_ID);
    expect(await tokenIsValid(SECRET, token, VOUCHER_ID)).toBe(true);
    expect(await tokenIsValid('b'.repeat(48), token, VOUCHER_ID)).toBe(false);
    expect(
      await tokenIsValid(SECRET, token, '8a1f0c2e-2222-4a2b-9c3d-000000000002'),
    ).toBe(false);
    expect(await tokenIsValid(SECRET, 'garbage', VOUCHER_ID)).toBe(false);
  });
});
