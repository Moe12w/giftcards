import { describe, expect, it } from 'vitest';

import {
  canRedeemSession,
  consumeSession,
  isSessionCard,
  isSessionExhausted,
  isSessionOffer,
  redemptionMode,
  sessionProgress,
  sessionTotal,
  sessionsRemaining,
  sessionsUsed,
  valueRemaining,
} from './sessions';
import type { GiftCard, RedemptionEntry } from './types';

function card(overrides: Partial<GiftCard> = {}): GiftCard {
  return {
    id: 'card-test',
    offer_id: 'offer-test',
    order_id: null,
    buyer_id: 'demo-user',
    recipient_name: 'Sara',
    recipient_email: 'sara@example.com',
    original_value_minor: 50000,
    status: 'claimed',
    claim_token_hash: null,
    claimed_by: 'demo-user',
    claimed_at: null,
    expires_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function sessionEntry(sessions: number, at = '2026-01-02T00:00:00.000Z'): RedemptionEntry {
  return {
    id: `entry-${sessions}-${at}`,
    card_id: 'card-test',
    kind: 'session',
    sessions,
    actor: 'Dune Spa',
    created_at: at,
  };
}

describe('redemptionMode', () => {
  it('defaults to money value', () => {
    expect(redemptionMode(null)).toBe('monetary');
    expect(redemptionMode({})).toBe('monetary');
    expect(redemptionMode({ fulfilment_type: 'monetary' })).toBe('monetary');
  });

  it('reads the session mode', () => {
    expect(redemptionMode({ fulfilment_type: 'experience' })).toBe('experience');
    expect(isSessionOffer({ fulfilment_type: 'experience' })).toBe(true);
    expect(isSessionOffer({ fulfilment_type: 'monetary' })).toBe(false);
    expect(isSessionCard({ fulfilment_type: 'experience' })).toBe(true);
  });
});

describe('single session cards', () => {
  it('holds exactly one session', () => {
    const massage = card({ fulfilment_type: 'experience', total_sessions: 1 });
    expect(sessionTotal(massage)).toBe(1);
    expect(sessionsRemaining(massage, [])).toBe(1);
    expect(canRedeemSession(massage, [])).toBe(true);
  });

  it('is finished after one use', () => {
    const massage = card({ fulfilment_type: 'experience', total_sessions: 1 });
    const entries = [sessionEntry(1)];
    expect(sessionsUsed(entries)).toBe(1);
    expect(sessionsRemaining(massage, entries)).toBe(0);
    expect(canRedeemSession(massage, entries)).toBe(false);
    expect(isSessionExhausted(massage, entries)).toBe(true);
  });
});

describe('session packages', () => {
  it('drops by one session per use', () => {
    const pack = card({ fulfilment_type: 'experience', total_sessions: 5 });
    let entries: RedemptionEntry[] = [];

    expect(sessionsRemaining(pack, entries)).toBe(5);

    entries = [...entries, sessionEntry(1)];
    expect(sessionsRemaining(pack, entries)).toBe(4);

    entries = [...entries, sessionEntry(1)];
    expect(sessionsRemaining(pack, entries)).toBe(3);
    expect(consumeSession(pack, entries)).toBe(2);
    expect(canRedeemSession(pack, entries)).toBe(true);
    expect(sessionProgress(pack, entries)).toBeCloseTo(0.4);
  });

  it('never goes below zero', () => {
    const pack = card({ fulfilment_type: 'experience', total_sessions: 1 });
    const entries = [sessionEntry(1), sessionEntry(1)];
    expect(sessionsRemaining(pack, entries)).toBe(0);
    expect(sessionProgress(pack, entries)).toBe(1);
  });
});

describe('value cards', () => {
  it('spend money and not sessions', () => {
    const coffee = card({ balance_minor: 20000 });
    const entries: RedemptionEntry[] = [
      {
        id: 'value-1',
        card_id: 'card-test',
        kind: 'monetary',
        amount_minor: 5000,
        actor: 'The Coffee House',
        created_at: '2026-01-03T00:00:00.000Z',
      },
    ];
    expect(sessionsUsed(entries)).toBe(0);
    expect(sessionsRemaining(coffee, entries)).toBe(0);
    expect(valueRemaining(coffee, entries)).toBe(15000);
  });

  it('keeps the stored balance when nothing was redeemed', () => {
    const coffee = card({ balance_minor: 20000, original_value_minor: 25000 });
    expect(valueRemaining(coffee, [])).toBe(20000);
  });
});
