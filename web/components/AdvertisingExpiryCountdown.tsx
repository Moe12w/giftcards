'use client';

import { useEffect, useState } from 'react';
import { AlarmClock, CalendarClock } from 'lucide-react';

/** One six-hour booking period: below this the window is called out as urgent. */
const URGENT_MS = 6 * 60 * 60 * 1000;

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  if (hours >= 24) {
    return `${Math.floor(hours / 24)}d ${pad(hours % 24)}h`;
  }
  return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
}

/**
 * Live "expires in" warning for an unpaid advertising draft. The server passes
 * the first measurement so the initial paint matches on both sides, then the
 * countdown ticks locally and flips to a hard stop when the window closes.
 */
export function AdvertisingExpiryCountdown({
  endsAt,
  endsAtLabel,
  initialRemainingMs,
}: {
  endsAt: string;
  /** Server-formatted end time, so the label never differs between server and client. */
  endsAtLabel: string;
  initialRemainingMs: number;
}) {
  const [remaining, setRemaining] = useState(initialRemainingMs);

  useEffect(() => {
    const target = new Date(endsAt).getTime();
    const tick = () => setRemaining(target - Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [endsAt]);

  if (remaining <= 0) {
    return (
      <div className="callout error">
        <CalendarClock size={16} /> This booking window has just ended, so payment is closed. Choose an available slot
        to re-book the draft.
      </div>
    );
  }

  if (remaining <= URGENT_MS) {
    return (
      <div className="callout warn">
        <AlarmClock size={16} /> This booking window ends in{' '}
        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatRemaining(remaining)}</strong> ({endsAtLabel}).
        Pay before then, or pick a new slot once it closes.
      </div>
    );
  }

  return (
    <div className="callout info">
      <AlarmClock size={16} /> Booking window closes in{' '}
      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatRemaining(remaining)}</strong> ({endsAtLabel}).
      Unpaid drafts have to be re-booked after that.
    </div>
  );
}
