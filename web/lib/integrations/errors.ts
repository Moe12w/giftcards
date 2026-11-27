/**
 * Pure error and payload-validation helpers for the external-platform API.
 *
 * This module has no server-only imports so it can be unit-tested on its own.
 * The gateway re-exports it for the route handlers.
 */

export type IntegrationErrorCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN_SCOPE'
  | 'PLATFORM_NOT_ACTIVE'
  | 'MAPPING_NOT_FOUND'
  | 'MAPPING_NOT_ACTIVE'
  | 'CARD_NOT_FOUND'
  | 'CARD_INACTIVE'
  | 'CARD_EXPIRED'
  | 'CARD_WRONG_BUSINESS'
  | 'CURRENCY_MISMATCH'
  | 'INSUFFICIENT_BALANCE'
  | 'RESERVATION_NOT_FOUND'
  | 'RESERVATION_EXPIRED'
  | 'RESERVATION_ALREADY_CAPTURED'
  | 'RESERVATION_NOT_CAPTURABLE'
  | 'AMOUNT_EXCEEDS_RESERVATION'
  | 'IDEMPOTENCY_CONFLICT'
  | 'IDEMPOTENCY_IN_PROGRESS'
  | 'RATE_LIMITED'
  | 'RECONCILIATION_REQUIRED'
  | 'REDEMPTION_NOT_FOUND'
  | 'PLATFORM_UNAVAILABLE'
  | 'INTERNAL_ERROR';

interface ErrorDefinition {
  status: number;
  message: string;
  retryable?: boolean;
}

const ERROR_DEFINITIONS: Record<IntegrationErrorCode, ErrorDefinition> = {
  INVALID_REQUEST: { status: 400, message: 'The request is invalid.' },
  UNAUTHORIZED: { status: 401, message: 'Authentication failed.' },
  FORBIDDEN_SCOPE: { status: 403, message: 'This credential cannot perform that operation.' },
  PLATFORM_NOT_ACTIVE: { status: 403, message: 'This platform is not active.' },
  MAPPING_NOT_FOUND: { status: 404, message: 'The business is not connected to this platform.' },
  MAPPING_NOT_ACTIVE: { status: 403, message: 'The business connection is not active.' },
  // Deliberately identical to CARD_WRONG_BUSINESS so the API is not an
  // existence oracle for other businesses' cards.
  CARD_NOT_FOUND: { status: 404, message: 'This gift card cannot be used here.' },
  CARD_INACTIVE: { status: 409, message: 'This gift card is not available for payment.' },
  CARD_EXPIRED: { status: 409, message: 'This gift card has expired.' },
  CARD_WRONG_BUSINESS: { status: 404, message: 'This gift card cannot be used here.' },
  CURRENCY_MISMATCH: { status: 409, message: 'The currency does not match this gift card.' },
  INSUFFICIENT_BALANCE: {
    status: 409,
    message: 'This gift card does not have enough available balance.',
  },
  RESERVATION_NOT_FOUND: { status: 404, message: 'The reservation was not found.' },
  RESERVATION_EXPIRED: { status: 409, message: 'The reservation has expired.' },
  RESERVATION_ALREADY_CAPTURED: {
    status: 409,
    message: 'The reservation has already been captured.',
  },
  RESERVATION_NOT_CAPTURABLE: {
    status: 409,
    message: 'The reservation can no longer be captured.',
  },
  AMOUNT_EXCEEDS_RESERVATION: {
    status: 409,
    message: 'The amount exceeds the reservation.',
  },
  IDEMPOTENCY_CONFLICT: {
    status: 409,
    message: 'The idempotency key was already used for a different request.',
  },
  IDEMPOTENCY_IN_PROGRESS: {
    status: 409,
    message: 'The same request is still being processed.',
    retryable: true,
  },
  RATE_LIMITED: { status: 429, message: 'Too many requests.', retryable: true },
  RECONCILIATION_REQUIRED: {
    status: 409,
    message: 'This payment needs manual reconciliation.',
  },
  REDEMPTION_NOT_FOUND: { status: 404, message: 'The redemption was not found.' },
  PLATFORM_UNAVAILABLE: {
    status: 503,
    message: 'The platform is temporarily unavailable.',
    retryable: true,
  },
  INTERNAL_ERROR: { status: 500, message: 'An internal error occurred.' },
};

export class IntegrationError extends Error {
  readonly code: IntegrationErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly persist: boolean;
  readonly detail?: string;

  constructor(
    code: IntegrationErrorCode,
    options: {
      message?: string;
      retryable?: boolean;
      persist?: boolean;
      detail?: string;
    } = {},
  ) {
    const definition = ERROR_DEFINITIONS[code];
    super(options.message ?? definition.message);
    this.name = 'IntegrationError';
    this.code = code;
    this.status = definition.status;
    this.retryable = options.retryable ?? definition.retryable ?? false;
    // Deterministic 4xx answers are safe to replay. 5xx and unknown failures
    // are abandoned so the platform can retry the same idempotency key.
    this.persist = options.persist ?? this.status < 500;
    this.detail = options.detail;
  }
}

const RPC_ERROR_MAP: Record<string, IntegrationErrorCode> = {
  'platform not active': 'PLATFORM_NOT_ACTIVE',
  'mapping not found': 'MAPPING_NOT_FOUND',
  'mapping not active': 'MAPPING_NOT_ACTIVE',
  'voucher not found': 'CARD_NOT_FOUND',
  'wrong business': 'CARD_WRONG_BUSINESS',
  'voucher not redeemable': 'CARD_INACTIVE',
  'voucher expired': 'CARD_EXPIRED',
  'voucher is not a monetary voucher': 'CARD_INACTIVE',
  'currency mismatch': 'CURRENCY_MISMATCH',
  'insufficient balance': 'INSUFFICIENT_BALANCE',
  'no balance': 'INSUFFICIENT_BALANCE',
  'reservation not found': 'RESERVATION_NOT_FOUND',
  'reservation not capturable': 'RESERVATION_NOT_CAPTURABLE',
  'reservation already captured': 'RESERVATION_ALREADY_CAPTURED',
  'reconciliation required': 'RECONCILIATION_REQUIRED',
  'redemption not found': 'REDEMPTION_NOT_FOUND',
  'refund not allowed': 'FORBIDDEN_SCOPE',
  'not allowed': 'FORBIDDEN_SCOPE',
  'invalid amount': 'INVALID_REQUEST',
  'invalid request': 'INVALID_REQUEST',
  'idempotency conflict': 'IDEMPOTENCY_CONFLICT',
  too_many_requests: 'RATE_LIMITED',
};

export function mapRpcError(error: unknown): IntegrationError {
  if (error instanceof IntegrationError) return error;

  const raw =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error ?? '');
  const message = raw.split('\n')[0]?.trim().toLowerCase() ?? '';

  for (const [needle, code] of Object.entries(RPC_ERROR_MAP)) {
    if (message === needle || message.includes(needle)) {
      return new IntegrationError(code, { detail: raw });
    }
  }

  return new IntegrationError('INTERNAL_ERROR', { detail: raw || 'unknown rpc error' });
}

export function cardReasonError(reason: string | null): IntegrationError {
  switch (reason) {
    case 'wrong_business':
    case 'not_found':
      return new IntegrationError('CARD_NOT_FOUND');
    case 'not_monetary':
    case 'inactive':
      return new IntegrationError('CARD_INACTIVE');
    case 'expired':
      return new IntegrationError('CARD_EXPIRED');
    case 'currency_mismatch':
      return new IntegrationError('CURRENCY_MISMATCH');
    case 'no_balance':
      return new IntegrationError('INSUFFICIENT_BALANCE');
    default:
      return new IntegrationError('CARD_NOT_FOUND');
  }
}

export function requireString(
  body: Record<string, unknown>,
  key: string,
  options: { maxLength?: number } = {},
): string {
  const value = body[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new IntegrationError('INVALID_REQUEST', { detail: `${key} is required` });
  }
  const trimmed = value.trim();
  if (options.maxLength && trimmed.length > options.maxLength) {
    throw new IntegrationError('INVALID_REQUEST', { detail: `${key} is too long` });
  }
  return trimmed;
}

export function optionalString(
  body: Record<string, unknown>,
  key: string,
  options: { maxLength?: number } = {},
): string | null {
  const value = body[key];
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new IntegrationError('INVALID_REQUEST', { detail: `${key} must be a string` });
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (options.maxLength && trimmed.length > options.maxLength) {
    throw new IntegrationError('INVALID_REQUEST', { detail: `${key} is too long` });
  }
  return trimmed;
}

export function requirePositiveInteger(
  body: Record<string, unknown>,
  key: string,
): number {
  const value = body[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new IntegrationError('INVALID_REQUEST', {
      detail: `${key} must be a positive integer in minor units`,
    });
  }
  return value;
}

export function optionalPositiveInteger(
  body: Record<string, unknown>,
  key: string,
): number | null {
  const value = body[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new IntegrationError('INVALID_REQUEST', {
      detail: `${key} must be a positive integer in minor units`,
    });
  }
  return value;
}
