import { describe, expect, it, vi } from 'vitest';

import { GiftCardCheckoutController, isExpired } from './controller';
import { SdkError } from './errors';
import type {
  CaptureData,
  CaptureRequest,
  GiftCardTransport,
  PreviewData,
  PreviewRequest,
  ReleaseData,
  ReleaseRequest,
  ReserveData,
  ReserveRequest,
  StatusData,
  ValidateData,
  ValidateRequest,
} from './types';

const OPTIONS = {
  externalVendorId: 'ext-1',
  externalBranchId: 'ext-1-01',
  externalOrderId: 'order-1',
  currency: 'QAR',
  orderAmountMinor: 20000,
};

const CARD = { masked_code: 'GFT-••••CD34EF', vendor_name: 'The Coffee House' };

class FakeTransport implements GiftCardTransport {
  reserves: ReserveRequest[] = [];
  releases: Array<{ reference: string; request: ReleaseRequest }> = [];
  statusCalls = 0;
  validation: ValidateData = {
    valid: true,
    reason: null,
    card: CARD,
    currency: 'QAR',
    balance_minor: 50000,
    reserved_minor: 0,
    available_minor: 50000,
    expires_at: '2027-11-11T12:00:00Z',
  };
  reservation: ReserveData = {
    status: 'active',
    reservation_reference: 'RSV-ABCDEF123456',
    currency: 'QAR',
    card: CARD,
    balance_minor: 50000,
    reserved_minor: 15000,
    available_minor: 35000,
    order_amount_minor: 20000,
    applied_amount_minor: 15000,
    remaining_order_amount_minor: 5000,
    expires_at: '2026-11-27T12:10:00Z',
  };
  statusData: StatusData = {
    status: 'active',
    reservation_reference: this.reservation.reservation_reference,
    external_order_id: 'order-1',
    amount_minor: 15000,
    currency: 'QAR',
    expires_at: this.reservation.expires_at,
    captured_at: null,
    released_at: null,
    redemption_reference: null,
  };

  async validate(_request: ValidateRequest) {
    return this.validation;
  }

  async preview(_request: PreviewRequest): Promise<PreviewData> {
    throw new Error('not used');
  }

  async reserve(request: ReserveRequest) {
    this.reserves.push(request);
    return this.reservation;
  }

  async capture(_reference: string, _request: CaptureRequest): Promise<CaptureData> {
    throw new Error('the SDK must never capture');
  }

  async release(reference: string, request: ReleaseRequest) {
    this.releases.push({ reference, request });
    return {
      status: 'released',
      reservation_reference: reference,
      released_at: '2026-11-27T12:00:01Z',
      release_reason: 'customer_removed',
    } satisfies ReleaseData;
  }

  async statusCall(_reference: string) {
    return this.statusData;
  }

  async status(_reference: string) {
    this.statusCalls += 1;
    return this.statusData;
  }
}

describe('GiftCardCheckoutController', () => {
  it('moves from idle to valid using backend-confirmed data', async () => {
    const transport = new FakeTransport();
    const controller = new GiftCardCheckoutController(transport, OPTIONS);
    const listener = vi.fn();
    controller.subscribe(listener);

    const state = await controller.validate(' GFT-AB12CD34EF ');

    expect(state.status).toBe('valid');
    expect(state).toMatchObject({
      status: 'valid',
      code: 'GFT-AB12CD34EF',
      balanceMinor: 50000,
      availableMinor: 50000,
    });
    expect(listener).toHaveBeenCalled();
  });

  it('reports an invalid card without exposing a reason to the UI copy', async () => {
    const transport = new FakeTransport();
    transport.validation = { valid: false, reason: 'wrong_business' };
    const controller = new GiftCardCheckoutController(transport, OPTIONS);

    const state = await controller.validate('GFT-AB12CD34EF');

    expect(state).toMatchObject({ status: 'invalid', reason: 'wrong_business' });
    if (state.status === 'invalid') {
      expect(state.message).toBe('This gift card cannot be used here.');
    }
  });

  it('applies the backend amount, not a client-calculated amount', async () => {
    const transport = new FakeTransport();
    const controller = new GiftCardCheckoutController(transport, OPTIONS);
    await controller.validate('GFT-AB12CD34EF');
    const state = await controller.apply(19000);

    expect(state.status).toBe('applied');
    if (state.status === 'applied') {
      expect(state.applied.appliedAmountMinor).toBe(15000);
      expect(state.applied.remainingOrderAmountMinor).toBe(5000);
    }
    expect(transport.reserves[0]?.requested_amount_minor).toBe(19000);
  });

  it('ignores duplicate submits and reuses one idempotency key', async () => {
    const transport = new FakeTransport();
    const pendingReserve: { resolve?: (value: ReserveData) => void } = {};
    transport.reserve = (request) => {
      transport.reserves.push(request);
      return new Promise<ReserveData>((resolve) => {
        pendingReserve.resolve = resolve;
      });
    };
    const controller = new GiftCardCheckoutController(transport, OPTIONS);
    await controller.validate('GFT-AB12CD34EF');

    const first = controller.apply();
    const second = controller.apply();
    expect(second).toBe(first);
    expect(transport.reserves).toHaveLength(1);

    pendingReserve.resolve?.(transport.reservation);
    await first;
    expect(transport.reserves).toHaveLength(1);
    expect(transport.reserves[0]?.idempotency_key).toMatch(/^sdk_/);
  });

  it('releases a hold on remove and returns to idle', async () => {
    const transport = new FakeTransport();
    const controller = new GiftCardCheckoutController(transport, OPTIONS);
    await controller.validate('GFT-AB12CD34EF');
    await controller.apply();

    const state = await controller.remove();

    expect(state.status).toBe('idle');
    expect(transport.releases).toHaveLength(1);
    expect(transport.releases[0]?.reference).toBe('RSV-ABCDEF123456');
  });

  it('learns about capture from status, without calling capture itself', async () => {
    const transport = new FakeTransport();
    transport.statusData = {
      ...transport.statusData,
      status: 'captured',
      captured_at: '2026-11-27T12:01:00Z',
      redemption_reference: 'RDM-123',
    };
    const controller = new GiftCardCheckoutController(transport, OPTIONS);
    await controller.validate('GFT-AB12CD34EF');
    await controller.apply();

    const state = await controller.refresh();

    expect(state.status).toBe('completed');
    if (state.status === 'completed') expect(state.redemptionReference).toBe('RDM-123');
    expect(transport.statusCalls).toBe(1);
  });

  it('maps a backend error into a safe retryable state', async () => {
    const transport = new FakeTransport();
    transport.validate = async () => {
      throw new SdkError('RATE_LIMITED', 'Too many attempts.', { retryable: true });
    };
    const controller = new GiftCardCheckoutController(transport, OPTIONS);

    const state = await controller.validate('GFT-AB12CD34EF');

    expect(state).toMatchObject({ status: 'error', code: 'RATE_LIMITED', retryable: true });
  });

  it('does not apply stale async results after a reset', async () => {
    const transport = new FakeTransport();
    const pendingValidation: { resolve?: (value: ValidateData) => void } = {};
    transport.validate = () =>
      new Promise<ValidateData>((resolve) => {
        pendingValidation.resolve = resolve;
      });
    const controller = new GiftCardCheckoutController(transport, OPTIONS);

    const pending = controller.validate('GFT-AB12CD34EF');
    controller.reset();
    pendingValidation.resolve?.(transport.validation);
    const state = await pending;

    expect(state.status).toBe('idle');
    expect(controller.getSnapshot().status).toBe('idle');
  });

  it('requires validation before applying', async () => {
    const controller = new GiftCardCheckoutController(new FakeTransport(), OPTIONS);
    await expect(controller.apply()).rejects.toBeInstanceOf(SdkError);
  });
});

describe('isExpired', () => {
  it('uses the backend expiry timestamp', () => {
    const controller = new GiftCardCheckoutController(new FakeTransport(), OPTIONS);
    expect(isExpired(controller.getSnapshot())).toBe(false);
    expect(
      isExpired(
        {
          status: 'applied',
          code: 'GFT-AB12CD34EF',
          applied: {
            reservationReference: 'RSV-ABCDEF123456',
            appliedAmountMinor: 15000,
            remainingOrderAmountMinor: 5000,
            currency: 'QAR',
            expiresAt: '2026-11-27T12:10:00Z',
            card: CARD,
          },
        },
        '2026-11-27T12:11:00Z',
      ),
    ).toBe(true);
  });
});
