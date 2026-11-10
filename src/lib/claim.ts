// src/lib/claim.ts
// Demo payload for the public claim experience. In production the claim page
// calls an Edge Function that hashes the token and returns only safe fields.
import { daysFromNow } from './time';

export interface ClaimGift {
  token: string;
  vendor: string;
  amountMinor: number;
  sender: string;
  message: string;
  expiresAt: string;
  code: string;
}

export const DEMO_CLAIM: ClaimGift = {
  token: 'demo-gift',
  vendor: 'The Coffee House',
  amountMinor: 10000,
  sender: 'Sara',
  message: 'Enjoy a coffee on me',
  expiresAt: daysFromNow(365),
  code: 'GIFTLY-DEMO-2026',
};
