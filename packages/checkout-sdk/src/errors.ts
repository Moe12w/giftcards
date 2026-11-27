import { API_VERSION } from './types';

export interface ApiErrorShape {
  code: string;
  message: string;
  retryable: boolean;
}

export interface ApiEnvelope<T> {
  ok: boolean;
  request_id?: string;
  data?: T;
  error?: ApiErrorShape;
}

export class SdkError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly requestId: string | null;
  readonly status: number | null;

  constructor(
    code: string,
    message: string,
    options: { retryable?: boolean; requestId?: string | null; status?: number | null } = {},
  ) {
    super(message);
    this.name = 'SdkError';
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.requestId = options.requestId ?? null;
    this.status = options.status ?? null;
  }
}

/** Safe, client-facing messages. The server message is kept on the error for logs. */
const PUBLIC_MESSAGES: Record<string, string> = {
  INVALID_REQUEST: 'Check the card details and try again.',
  UNAUTHORIZED: 'Payment is temporarily unavailable. Please try again.',
  FORBIDDEN_SCOPE: 'This payment method is not available for this order.',
  PLATFORM_NOT_ACTIVE: 'This payment method is temporarily unavailable.',
  MAPPING_NOT_FOUND: 'This business is not set up for gift-card payments here.',
  MAPPING_NOT_ACTIVE: 'This business is not currently accepting gift cards here.',
  CARD_NOT_FOUND: 'This gift card cannot be used here.',
  CARD_INACTIVE: 'This gift card is not available for payment.',
  CARD_EXPIRED: 'This gift card has expired.',
  CARD_WRONG_BUSINESS: 'This gift card cannot be used here.',
  CURRENCY_MISMATCH: 'The gift card currency does not match this order.',
  INSUFFICIENT_BALANCE: 'This gift card does not have enough available balance.',
  RESERVATION_NOT_FOUND: 'This gift-card payment is no longer available.',
  RESERVATION_EXPIRED: 'The gift-card hold expired. Please apply the card again.',
  RESERVATION_ALREADY_CAPTURED: 'This gift-card payment was already completed.',
  RESERVATION_NOT_CAPTURABLE: 'This gift-card payment can no longer be changed.',
  AMOUNT_EXCEEDS_RESERVATION: 'The amount is higher than the applied gift-card amount.',
  IDEMPOTENCY_CONFLICT: 'The payment is being processed. Please wait and try again.',
  IDEMPOTENCY_IN_PROGRESS: 'The payment is being processed. Please wait and try again.',
  RATE_LIMITED: 'Too many attempts. Please wait a moment.',
  RECONCILIATION_REQUIRED: 'This payment needs manual review. No money was moved.',
  REDEMPTION_NOT_FOUND: 'This gift-card payment was not found.',
  PLATFORM_UNAVAILABLE: 'Payment is temporarily unavailable. Please try again.',
  INTERNAL_ERROR: 'Payment is temporarily unavailable. Please try again.',
};

export function publicMessage(code: string, fallback?: string): string {
  return PUBLIC_MESSAGES[code] ?? fallback ?? 'Payment is temporarily unavailable.';
}

/** Card-state reasons from the read-only validate endpoint. */
const CARD_REASON_CODES: Record<string, string> = {
  not_found: 'CARD_NOT_FOUND',
  wrong_business: 'CARD_NOT_FOUND',
  not_monetary: 'CARD_INACTIVE',
  inactive: 'CARD_INACTIVE',
  expired: 'CARD_EXPIRED',
  currency_mismatch: 'CURRENCY_MISMATCH',
  no_balance: 'INSUFFICIENT_BALANCE',
};

export function cardReasonCode(reason: string): string {
  return CARD_REASON_CODES[reason] ?? 'INTERNAL_ERROR';
}

export function unwrapEnvelope<T>(body: unknown, status: number): T {
  const envelope = body as ApiEnvelope<T> | null;
  if (!envelope || typeof envelope !== 'object') {
    throw new SdkError('INTERNAL_ERROR', publicMessage('INTERNAL_ERROR'), { status });
  }

  const requestId = typeof envelope.request_id === 'string' ? envelope.request_id : null;

  if (!envelope.ok || envelope.error) {
    const code = envelope.error?.code ?? 'INTERNAL_ERROR';
    throw new SdkError(code, publicMessage(code, envelope.error?.message), {
      retryable: envelope.error?.retryable ?? code === 'RATE_LIMITED',
      requestId,
      status,
    });
  }

  if (envelope.data === undefined) {
    throw new SdkError('INTERNAL_ERROR', publicMessage('INTERNAL_ERROR'), { requestId, status });
  }

  return envelope.data;
}

export function assertApiVersion(version: string): void {
  if (version !== API_VERSION) {
    throw new Error(`Unsupported Tazella API version: ${version}`);
  }
}
