import { describe, expect, it } from 'vitest';
import { mapVoucherClaims } from './claim-links';

describe('mapVoucherClaims', () => {
  it('pairs each voucher with its own claim token', () => {
    const claims = mapVoucherClaims(['v1', 'v2', 'v3'], ['t1', 't2', 't3']);
    expect(claims).toEqual([
      { voucherId: 'v1', claimToken: 't1' },
      { voucherId: 'v2', claimToken: 't2' },
      { voucherId: 'v3', claimToken: 't3' },
    ]);
  });

  it('skips vouchers without a matching token instead of reusing one', () => {
    expect(mapVoucherClaims(['v1', 'v2'], ['t1'])).toEqual([{ voucherId: 'v1', claimToken: 't1' }]);
  });
});
