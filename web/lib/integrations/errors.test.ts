import { describe, expect, it } from 'vitest';

import {
  cardReasonError,
  IntegrationError,
  mapRpcError,
  optionalPositiveInteger,
  optionalString,
  requirePositiveInteger,
  requireString,
} from './errors';

describe('IntegrationError', () => {
  it('uses a safe public message and the right status', () => {
    const error = new IntegrationError('CARD_NOT_FOUND');
    expect(error.status).toBe(404);
    expect(error.message).not.toContain('voucher');
    expect(error.retryable).toBe(false);
  });

  it('shares one public message for not-found and wrong-business', () => {
    expect(new IntegrationError('CARD_NOT_FOUND').message).toBe(
      new IntegrationError('CARD_WRONG_BUSINESS').message,
    );
  });

  it('persists deterministic 4xx responses but not internal errors', () => {
    expect(new IntegrationError('INSUFFICIENT_BALANCE').persist).toBe(true);
    expect(new IntegrationError('INTERNAL_ERROR').persist).toBe(false);
    expect(new IntegrationError('RATE_LIMITED').retryable).toBe(true);
  });
});

describe('mapRpcError', () => {
  it('maps known database tokens', () => {
    expect(mapRpcError({ message: 'platform not active' }).code).toBe('PLATFORM_NOT_ACTIVE');
    expect(mapRpcError({ message: 'voucher expired' }).code).toBe('CARD_EXPIRED');
    expect(mapRpcError({ message: 'wrong business' }).code).toBe('CARD_WRONG_BUSINESS');
    expect(mapRpcError({ message: 'insufficient balance' }).code).toBe('INSUFFICIENT_BALANCE');
    expect(mapRpcError({ message: 'reconciliation required' }).code).toBe(
      'RECONCILIATION_REQUIRED',
    );
  });

  it('strips database context from a message', () => {
    const error = mapRpcError({
      message: 'voucher expired\nCONTEXT: PL/pgSQL function integration_reserve',
    });
    expect(error.code).toBe('CARD_EXPIRED');
    expect(error.detail).toContain('CONTEXT');
  });

  it('falls back to a generic internal error', () => {
    const error = mapRpcError({ message: 'relation "foo" does not exist' });
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.message).toBe('An internal error occurred.');
    expect(error.detail).toContain('relation');
  });

  it('passes through an existing IntegrationError', () => {
    const original = new IntegrationError('IDEMPOTENCY_CONFLICT');
    expect(mapRpcError(original)).toBe(original);
  });
});

describe('cardReasonError', () => {
  it('never reveals a card belonging to another business', () => {
    expect(cardReasonError('wrong_business').code).toBe('CARD_NOT_FOUND');
    expect(cardReasonError('not_found').code).toBe('CARD_NOT_FOUND');
  });

  it('maps each card state to one public error', () => {
    expect(cardReasonError('expired').code).toBe('CARD_EXPIRED');
    expect(cardReasonError('inactive').code).toBe('CARD_INACTIVE');
    expect(cardReasonError('not_monetary').code).toBe('CARD_INACTIVE');
    expect(cardReasonError('currency_mismatch').code).toBe('CURRENCY_MISMATCH');
    expect(cardReasonError('no_balance').code).toBe('INSUFFICIENT_BALANCE');
  });
});

describe('payload validators', () => {
  it('requires non-empty strings and applies length limits', () => {
    expect(requireString({ card_code: ' GFT-123 ' }, 'card_code')).toBe('GFT-123');
    expect(() => requireString({ card_code: '' }, 'card_code')).toThrow(IntegrationError);
    expect(() =>
      requireString({ card_code: 'x'.repeat(201) }, 'card_code', { maxLength: 200 }),
    ).toThrow(IntegrationError);
  });

  it('treats blank optional strings as absent', () => {
    expect(optionalString({}, 'external_branch_id')).toBeNull();
    expect(optionalString({ external_branch_id: '  ' }, 'external_branch_id')).toBeNull();
    expect(optionalString({ external_branch_id: ' b1 ' }, 'external_branch_id')).toBe('b1');
  });

  it('accepts only positive safe integers in minor units', () => {
    expect(requirePositiveInteger({ amount_minor: 15000 }, 'amount_minor')).toBe(15000);
    expect(optionalPositiveInteger({}, 'ttl_seconds')).toBeNull();
    for (const value of [0, -1, 1.5, '100', Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => requirePositiveInteger({ amount_minor: value }, 'amount_minor')).toThrow(
        IntegrationError,
      );
    }
  });
});
