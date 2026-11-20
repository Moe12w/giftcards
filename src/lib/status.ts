// src/lib/status.ts
// Shared badge tones for wallet card statuses. Four screens used to keep
// identical copies, which is how a status could look different in one of them.
import type { BadgeTone } from '@/src/components/Badge';
import type { CardStatus } from './types';

export const CARD_STATUS_TONE: Record<CardStatus, BadgeTone> = {
  issued: 'warning',
  claimed: 'success',
  redeemed: 'neutral',
  expired: 'danger',
  voided: 'danger',
};
