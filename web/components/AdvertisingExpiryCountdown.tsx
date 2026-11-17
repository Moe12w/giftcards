'use client';

import { useEffect, useState } from 'react';
import { AlarmClock } from 'lucide-react';

/** The slot is held for two minutes while the advertiser pays. */
const HOLD_MINUTES = 2;

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

/**
 * Live countdown for the two-minute slot hold an unpaid draft has at checkout.
 *
 * The server passes the first measurement so the initial paint matches on both
 * sides, then the countdown ticks locally and turns into a "hold ended" warning
 * when the slot is released to everyone else.
 */
export function AdvertisingExpiryCountdown({
  holdExpiresAt,
  initialRemainingMs,
}: {
  /** When the current hold ends; null before any hold exists. */
  holdExpiresAt: string | null;
  initialRemainingMs: number;
}) {
  const [remaining, setRemaining] = useState(initialRemainingMs);

  useEffect(() => {
    if (!holdExpiresAt) return;
    const target = new Date(holdExpiresAt).getTime();
    const tick = () => setRemaining(target - Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [holdExpiresAt]);

  if (!holdExpiresAt || remaining <= 0) {
    return (
      <div className="callout warn">
        <AlarmClock size={16} /> Your {HOLD_MINUTES}-minute hold has ended. The slot is released and anyone can book
        it now — pay immediately, or go back and pick another slot.
      </div>
    );
  }

  return (
    <div className="callout warn">
      <AlarmClock size={16} /> Slot held for{' '}
      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatRemaining(remaining)}</strong>. Pay before it runs
      out — after that the slot is released and someone else can book it.
    </div>
  );
}
