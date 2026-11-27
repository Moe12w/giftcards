// Public types for the Tazella checkout SDK.
//
// All amounts are integer minor units. The host's backend is the only place
// that talks to Tazella with a credential; these types describe the responses
// that the host backend passes back to the checkout UI.

export const SDK_VERSION = '0.1.0';
export const API_VERSION = 'v1';

export interface CardSummary {
  masked_code: string | null;
  vendor_name: string | null;
}

export interface CardRestrictions {
  monetary_only: boolean;
  partial_allowed: boolean;
}

export interface ValidateData {
  valid: boolean;
  reason: string | null;
  card?: CardSummary | null;
  currency?: string | null;
  balance_minor?: number | null;
  reserved_minor?: number | null;
  available_minor?: number | null;
  expires_at?: string | null;
  restrictions?: CardRestrictions;
}

export interface PreviewData {
  card: CardSummary | null;
  currency: string | null;
  balance_minor: number;
  reserved_minor: number;
  available_minor: number;
  order_amount_minor: number;
  applied_amount_minor: number;
  remaining_order_amount_minor: number;
  expires_at: string | null;
}

export interface ReserveData {
  status: string;
  reservation_reference: string;
  currency: string;
  card: CardSummary | null;
  balance_minor: number;
  reserved_minor: number;
  available_minor: number;
  order_amount_minor: number;
  applied_amount_minor: number;
  remaining_order_amount_minor: number;
  expires_at: string;
}

export interface StatusData {
  status: string;
  reservation_reference: string;
  external_order_id: string;
  amount_minor: number;
  currency: string;
  expires_at: string;
  captured_at: string | null;
  released_at: string | null;
  redemption_reference: string | null;
}

export interface CaptureData {
  status: string;
  reservation_reference: string;
  redemption_id: string | null;
  redemption_reference: string | null;
  amount_minor: number;
  currency: string;
  card: CardSummary | null;
  new_balance_minor: number | null;
  captured_at: string | null;
}

export interface ReleaseData {
  status: string;
  reservation_reference: string;
  released_at: string | null;
  release_reason: string | null;
}

export interface ValidateRequest {
  external_vendor_id: string;
  external_branch_id?: string | null;
  card_code: string;
  currency?: string | null;
}

export interface PreviewRequest {
  external_vendor_id: string;
  external_branch_id?: string | null;
  external_order_id: string;
  card_code: string;
  order_amount_minor: number;
  requested_amount_minor?: number | null;
  currency: string;
}

export interface ReserveRequest extends PreviewRequest {
  ttl_seconds?: number | null;
  idempotency_key: string;
}

export interface CaptureRequest {
  external_vendor_id: string;
  external_branch_id?: string | null;
  external_payment_reference?: string | null;
  confirmed_order_amount_minor?: number | null;
  currency: string;
  idempotency_key: string;
}

export interface ReleaseRequest {
  external_vendor_id: string;
  external_branch_id?: string | null;
  reason?: string | null;
  idempotency_key: string;
}

/** Implemented by the host platform's backend, never by a browser bundle. */
export interface GiftCardTransport {
  validate(request: ValidateRequest): Promise<ValidateData>;
  preview(request: PreviewRequest): Promise<PreviewData>;
  reserve(request: ReserveRequest): Promise<ReserveData>;
  capture(reference: string, request: CaptureRequest): Promise<CaptureData>;
  release(reference: string, request: ReleaseRequest): Promise<ReleaseData>;
  status(reference: string): Promise<StatusData>;
}

export interface AppliedGiftCard {
  reservationReference: string;
  appliedAmountMinor: number;
  remainingOrderAmountMinor: number;
  currency: string;
  expiresAt: string;
  card: CardSummary | null;
}

export type CheckoutState =
  | { status: 'idle' }
  | { status: 'validating'; code: string }
  | { status: 'invalid'; code: string; reason: string; message: string }
  | {
      status: 'valid';
      code: string;
      card: CardSummary | null;
      currency: string | null;
      balanceMinor: number;
      reservedMinor: number;
      availableMinor: number;
      expiresAt: string | null;
    }
  | { status: 'applying'; code: string }
  | { status: 'applied'; code: string; applied: AppliedGiftCard }
  | { status: 'removing'; code: string; applied: AppliedGiftCard }
  | { status: 'completed'; code: string; applied: AppliedGiftCard; redemptionReference: string | null }
  | { status: 'error'; code: string; message: string; retryable: boolean; previous: CheckoutState };
