/** Pure helper: pair each issued voucher with the token that belongs to it. */
export interface VoucherClaim {
  voucherId: string;
  claimToken: string;
}

export function mapVoucherClaims(voucherIds: string[], claimTokens: string[]): VoucherClaim[] {
  return voucherIds
    .map((voucherId, index) => ({ voucherId, claimToken: claimTokens[index] }))
    .filter((claim): claim is VoucherClaim => Boolean(claim.claimToken));
}
