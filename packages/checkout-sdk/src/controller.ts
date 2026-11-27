import { cardReasonCode, SdkError, publicMessage } from './errors';
import type {
  AppliedGiftCard,
  CheckoutState,
  GiftCardTransport,
  PreviewData,
} from './types';

export interface CheckoutControllerOptions {
  externalVendorId: string;
  externalBranchId?: string | null;
  externalOrderId: string;
  currency: string;
  orderAmountMinor: number;
  requestedAmountMinor?: number | null;
  ttlSeconds?: number | null;
  idempotencyKeyFactory?: () => string;
}

export interface OrderUpdate {
  externalOrderId?: string;
  orderAmountMinor?: number;
  requestedAmountMinor?: number | null;
  currency?: string;
}

function defaultIdempotencyKey(): string {
  const maybeCrypto = globalThis.crypto;
  if (maybeCrypto && typeof maybeCrypto.randomUUID === 'function') {
    return `sdk_${maybeCrypto.randomUUID()}`;
  }
  return `sdk_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function codeOf(state: CheckoutState): string {
  return 'code' in state ? state.code : '';
}

function asSdkError(error: unknown, fallbackCode: string): SdkError {
  if (error instanceof SdkError) return error;
  return new SdkError(
    fallbackCode,
    error instanceof Error ? error.message : publicMessage(fallbackCode),
  );
}

/**
 * Framework-agnostic checkout controller.
 *
 * The controller never holds a platform credential and never decides an
 * amount, balance or capture. It only requests operations through the host's
 * transport and reflects what the backend confirmed.
 */
export class GiftCardCheckoutController {
  private state: CheckoutState = { status: 'idle' };
  private readonly listeners = new Set<() => void>();
  private pending: Promise<CheckoutState> | null = null;
  private epoch = 0;
  private order: CheckoutControllerOptions;
  private readonly keyFactory: () => string;
  private reserveKey: string | null = null;
  private releaseKey: string | null = null;

  constructor(
    private readonly transport: GiftCardTransport,
    options: CheckoutControllerOptions,
  ) {
    this.order = { ...options };
    this.keyFactory = options.idempotencyKeyFactory ?? defaultIdempotencyKey;
  }

  getSnapshot = (): CheckoutState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private set(next: CheckoutState): CheckoutState {
    this.state = next;
    this.emit();
    return next;
  }

  private setIfCurrent(epoch: number, next: CheckoutState): CheckoutState {
    if (epoch !== this.epoch) return this.state;
    return this.set(next);
  }

  /** One in-flight request at a time; duplicate submits get the same promise. */
  private run(work: (epoch: number) => Promise<CheckoutState>): Promise<CheckoutState> {
    if (this.pending) return this.pending;

    const epoch = this.epoch;
    const promise = (async () => {
      try {
        return await work(epoch);
      } catch (error) {
        const mapped = asSdkError(error, 'INTERNAL_ERROR');
        return this.setIfCurrent(epoch, {
          status: 'error',
          code: mapped.code,
          message: mapped.message,
          retryable: mapped.retryable,
          previous: this.state,
        });
      }
    })().finally(() => {
      this.pending = null;
    });

    this.pending = promise;
    return promise;
  }

  setOrder(update: OrderUpdate): void {
    this.order = { ...this.order, ...update };
  }

  reset(): void {
    this.epoch += 1;
    this.pending = null;
    this.reserveKey = null;
    this.releaseKey = null;
    this.set({ status: 'idle' });
  }

  validate(rawCode: string): Promise<CheckoutState> {
    if (this.pending) return this.pending;
    const code = rawCode.trim();
    if (!code) {
      return Promise.reject(new SdkError('INVALID_REQUEST', publicMessage('INVALID_REQUEST')));
    }

    return this.run(async (epoch) => {
      this.setIfCurrent(epoch, { status: 'validating', code });
      const data = await this.transport.validate({
        external_vendor_id: this.order.externalVendorId,
        external_branch_id: this.order.externalBranchId ?? null,
        card_code: code,
        currency: this.order.currency,
      });

      if (!data.valid) {
        return this.setIfCurrent(epoch, {
          status: 'invalid',
          code,
          reason: data.reason ?? 'unknown',
          message: publicMessage(cardReasonCode(data.reason ?? '')),
        });
      }

      this.reserveKey = null;
      this.releaseKey = null;

      return this.setIfCurrent(epoch, {
        status: 'valid',
        code,
        card: data.card ?? null,
        currency: data.currency ?? this.order.currency,
        balanceMinor: data.balance_minor ?? 0,
        reservedMinor: data.reserved_minor ?? 0,
        availableMinor: data.available_minor ?? 0,
        expiresAt: data.expires_at ?? null,
      });
    });
  }

  /** Read-only preview. Does not change the checkout state. */
  preview(rawCode?: string): Promise<PreviewData> {
    const code = rawCode?.trim() || codeOf(this.state);
    if (!code) {
      return Promise.reject(new SdkError('INVALID_REQUEST', publicMessage('INVALID_REQUEST')));
    }

    return this.transport.preview({
      external_vendor_id: this.order.externalVendorId,
      external_branch_id: this.order.externalBranchId ?? null,
      external_order_id: this.order.externalOrderId,
      card_code: code,
      order_amount_minor: this.order.orderAmountMinor,
      requested_amount_minor: this.order.requestedAmountMinor ?? null,
      currency: this.order.currency,
    });
  }

  apply(requestedAmountMinor?: number): Promise<CheckoutState> {
    if (this.pending) return this.pending;
    const state = this.state;
    if (state.status !== 'valid') {
      return Promise.reject(
        new SdkError('INVALID_REQUEST', 'Validate a gift card before applying it.'),
      );
    }

    const code = state.code;
    const key = (this.reserveKey ??= this.keyFactory());

    return this.run(async (epoch) => {
      this.setIfCurrent(epoch, { status: 'applying', code });

      const data = await this.transport.reserve({
        external_vendor_id: this.order.externalVendorId,
        external_branch_id: this.order.externalBranchId ?? null,
        external_order_id: this.order.externalOrderId,
        card_code: code,
        order_amount_minor: this.order.orderAmountMinor,
        requested_amount_minor: requestedAmountMinor ?? this.order.requestedAmountMinor ?? null,
        currency: this.order.currency,
        ttl_seconds: this.order.ttlSeconds ?? null,
        idempotency_key: key,
      });

      const applied: AppliedGiftCard = {
        reservationReference: data.reservation_reference,
        appliedAmountMinor: data.applied_amount_minor,
        remainingOrderAmountMinor: data.remaining_order_amount_minor,
        currency: data.currency,
        expiresAt: data.expires_at,
        card: data.card,
      };

      // Capture is a backend decision; the UI only learns about it via status.
      return this.setIfCurrent(epoch, { status: 'applied', code, applied });
    });
  }

  remove(): Promise<CheckoutState> {
    if (this.pending) return this.pending;
    const state = this.state;
    if (state.status !== 'applied') {
      return Promise.reject(
        new SdkError('INVALID_REQUEST', 'There is no applied gift card to remove.'),
      );
    }

    const { code, applied } = state;
    const key = (this.releaseKey ??= this.keyFactory());

    return this.run(async (epoch) => {
      this.setIfCurrent(epoch, { status: 'removing', code, applied });
      await this.transport.release(applied.reservationReference, {
        external_vendor_id: this.order.externalVendorId,
        external_branch_id: this.order.externalBranchId ?? null,
        reason: 'customer_removed',
        idempotency_key: key,
      });
      this.releaseKey = null;
      this.reserveKey = null;
      return this.setIfCurrent(epoch, { status: 'idle' });
    });
  }

  /** Refresh reservation state. Backend capture appears as `completed`. */
  async refresh(): Promise<CheckoutState> {
    const state = this.state;
    if (
      state.status !== 'applied' &&
      state.status !== 'removing' &&
      state.status !== 'completed'
    ) {
      return state;
    }

    const reference = state.applied.reservationReference;
    const code = state.code;

    return this.run(async (epoch) => {
      const data = await this.transport.status(reference);

      if (data.status === 'captured') {
        return this.setIfCurrent(epoch, {
          status: 'completed',
          code,
          applied: state.applied,
          redemptionReference: data.redemption_reference,
        });
      }

      if (data.status === 'released' || data.status === 'expired') {
        return this.setIfCurrent(epoch, { status: 'idle' });
      }

      if (data.status === 'reconciliation') {
        return this.setIfCurrent(epoch, {
          status: 'error',
          code,
          message: publicMessage('RECONCILIATION_REQUIRED'),
          retryable: false,
          previous: state,
        });
      }

      const applied: AppliedGiftCard = {
        ...state.applied,
        appliedAmountMinor: data.amount_minor,
        expiresAt: data.expires_at,
      };
      return this.setIfCurrent(epoch, { status: 'applied', code, applied });
    });
  }
}

/** ISO timestamps sort lexicographically; no clock decision in the controller. */
export function isExpired(state: CheckoutState, nowIso?: string): boolean {
  if (state.status !== 'applied') return false;
  const now = nowIso ?? new Date().toISOString();
  return state.applied.expiresAt <= now;
}
