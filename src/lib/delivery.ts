// src/lib/delivery.ts
// Whether a gift has actually arrived yet.
//
// A gift bought for a future date is issued straight away: the voucher, its
// balance and its claim link all exist. It is simply not available to spend
// until its date. The scheduled job flips `delivery_status` to `delivered` on
// that date; before then `scheduled_for` is still in the future, so the wallet
// shows the gift as waiting instead of ready to use.
import type { GiftCard } from './types';

/** True while the gift is still waiting for the date it was bought for. */
export function isGiftWaiting(card: GiftCard): boolean {
  const delivery = String(card.delivery_status ?? '');

  // Delivered or opened: it has arrived, whatever the date column says.
  if (delivery === 'delivered' || delivery === 'opened') return false;

  if (!card.scheduled_for) {
    // A scheduled flag with no date stays waiting until the job clears it.
    return delivery === 'scheduled';
  }

  return new Date(card.scheduled_for).getTime() > Date.now();
}
