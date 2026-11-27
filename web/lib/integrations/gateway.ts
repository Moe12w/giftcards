import 'server-only';

import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Shared server-only plumbing for the external-platform gift-card API.
 *
 * Everything financial is decided by Postgres RPCs. This module only:
 *   * authenticates a platform credential;
 *   * verifies the request signature and timestamp;
 *   * applies the per-credential rate limit;
 *   * enforces idempotent replay;
 *   * translates RPC errors into the public error envelope.
 *
 * It never reads or writes a balance.
 */

export type IntegrationEnvironment = 'sandbox' | 'production';

import { IntegrationError, mapRpcError } from './errors';

export {
  cardReasonError,
  IntegrationError,
  mapRpcError,
  optionalPositiveInteger,
  optionalString,
  requirePositiveInteger,
  requireString,
} from './errors';

export interface IntegrationContext {
  admin: ReturnType<typeof createAdminClient>;
  requestId: string;
  platformId: string;
  platformCode: string;
  platformName: string;
  platformStatus: string;
  capabilities: Record<string, unknown>;
  credentialId: string;
  credentialMappingId: string | null;
  environment: IntegrationEnvironment;
  signingSecret: string | null;
  idempotencyKey: string | null;
  rawBody: string;
  body: Record<string, unknown>;
  startedAt: number;
}

interface AuthenticatedCredential {
  credential_id: string;
  platform_id: string;
  platform_code: string;
  platform_name: string;
  platform_status: string;
  credential_status: string;
  environment: IntegrationEnvironment;
  signing_secret: string | null;
  capabilities: Record<string, unknown> | null;
  mapping_id: string | null;
}

interface OperationClaim {
  state: 'claimed' | 'replay' | 'conflict' | 'in_progress';
  response_status: number | null;
  response_body: { ok: boolean; data?: unknown; error?: unknown } | null;
  resource_type: string | null;
  resource_id: string | null;
}

interface StoredResponse {
  ok: boolean;
  data?: unknown;
  error?: unknown;
}

export interface OperationResult {
  status?: number;
  data: unknown;
  resourceType?: string;
  resourceId?: string;
}

const SIGNATURE_TOLERANCE_SECONDS = 300;
const RATE_LIMIT_MAX = 120;
const RATE_LIMIT_WINDOW_SECONDS = 60;

// ---------------------------------------------------------------------------
// Envelope helpers
// ---------------------------------------------------------------------------
export function jsonResponse(
  status: number,
  body: StoredResponse | Record<string, unknown>,
  requestId: string,
): NextResponse {
  return NextResponse.json({ request_id: requestId, ...body }, { status });
}

export function errorResponse(error: IntegrationError, requestId: string): NextResponse {
  return jsonResponse(
    error.status,
    {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
      },
    },
    requestId,
  );
}

// ---------------------------------------------------------------------------
// Body parsing and validation
// ---------------------------------------------------------------------------
function parseBody(rawBody: string): Record<string, unknown> {
  if (!rawBody.trim()) {
    throw new IntegrationError('INVALID_REQUEST', { detail: 'empty body' });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new IntegrationError('INVALID_REQUEST', { detail: 'invalid json' });
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new IntegrationError('INVALID_REQUEST', { detail: 'body must be an object' });
  }

  return parsed as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------
function bearerKey(headers: Headers): string | null {
  const direct = headers.get('x-api-key');
  if (direct?.trim()) return direct.trim();

  const authorization = headers.get('authorization');
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1]?.trim() ?? null;
}

function verifySignature(
  headers: Headers,
  rawBody: string,
  signingSecret: string,
): void {
  const timestamp = headers.get('x-timestamp');
  const signature = headers.get('x-signature');

  if (!timestamp || !signature) {
    throw new IntegrationError('UNAUTHORIZED', { detail: 'missing signature headers' });
  }

  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) {
    throw new IntegrationError('UNAUTHORIZED', { detail: 'invalid timestamp' });
  }

  const skew = Math.abs(Math.floor(Date.now() / 1000) - seconds);
  if (skew > SIGNATURE_TOLERANCE_SECONDS) {
    throw new IntegrationError('UNAUTHORIZED', { detail: 'timestamp skew' });
  }

  const expected = createHmac('sha256', signingSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  const provided = signature.trim().toLowerCase();
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const providedBuffer = Buffer.from(provided, 'utf8');

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    throw new IntegrationError('UNAUTHORIZED', { detail: 'bad signature' });
  }
}

async function authenticate(
  headers: Headers,
  rawBody: string,
  operation: string,
  options: { requireSignature: boolean },
): Promise<{
  admin: ReturnType<typeof createAdminClient>;
  credential: AuthenticatedCredential;
}> {
  const key = bearerKey(headers);
  if (!key) {
    throw new IntegrationError('UNAUTHORIZED', { detail: 'missing api key' });
  }

  const platformCode = headers.get('x-platform-code')?.trim();
  const environment = headers.get('x-environment')?.trim();
  if (!platformCode || (environment !== 'sandbox' && environment !== 'production')) {
    throw new IntegrationError('UNAUTHORIZED', {
      detail: 'missing platform code or environment',
    });
  }

  const admin = createAdminClient();

  const { data: keyHash, error: hashError } = await admin.rpc('integration_hash_key', {
    p_key: key,
  });
  if (hashError || typeof keyHash !== 'string') {
    throw new IntegrationError('INTERNAL_ERROR', { detail: 'could not hash key' });
  }

  const { data, error } = await admin.rpc('integration_authenticate', {
    p_key_hash: keyHash,
    p_platform_code: platformCode,
    p_environment: environment,
  });
  if (error) {
    throw new IntegrationError('INTERNAL_ERROR', { detail: error.message });
  }

  const rows = (Array.isArray(data) ? data : data ? [data] : []) as AuthenticatedCredential[];
  const credential = rows[0];
  if (!credential || credential.credential_status !== 'active') {
    throw new IntegrationError('UNAUTHORIZED', { detail: 'unknown or revoked credential' });
  }
  if (credential.platform_status !== 'active') {
    throw new IntegrationError('PLATFORM_NOT_ACTIVE', {
      detail: `platform status ${credential.platform_status}`,
    });
  }

  if (credential.signing_secret) {
    if (options.requireSignature) {
      verifySignature(headers, rawBody, credential.signing_secret);
    }
  } else if (credential.environment === 'production') {
    // Bearer-only production access is a risk acceptance recorded per
    // platform; until that exists, production credentials must sign.
    throw new IntegrationError('FORBIDDEN_SCOPE', {
      detail: 'bearer-only credentials are not allowed in production',
    });
  }

  const { error: rateError } = await admin.rpc('integration_rate_limit', {
    p_key: `integration:${credential.credential_id}:${operation}`,
    p_max: RATE_LIMIT_MAX,
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
  });
  if (rateError) {
    if (rateError.message.toLowerCase().includes('too_many_requests')) {
      throw new IntegrationError('RATE_LIMITED');
    }
    // Rate limiting is protective, not financial. A logging-side failure must
    // not block a legitimate capture.
    console.warn('integration rate limit unavailable:', rateError.message);
  }

  return { admin, credential };
}

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function requestHash(body: Record<string, unknown>): string {
  return createHash('sha256').update(stableStringify(body)).digest('hex');
}

async function claimOperation(
  context: IntegrationContext,
  operation: string,
): Promise<OperationClaim | null> {
  const key = context.idempotencyKey;
  if (!key) return null;

  const { data, error } = await context.admin.rpc('integration_claim_operation', {
    p_platform_id: context.platformId,
    p_operation: operation,
    p_idempotency_key: key,
    p_request_hash: requestHash(context.body),
  });
  if (error) throw mapRpcError(error);

  const rows = (Array.isArray(data) ? data : data ? [data] : []) as OperationClaim[];
  return rows[0] ?? null;
}

async function completeOperation(
  context: IntegrationContext,
  operation: string,
  responseStatus: number,
  responseBody: StoredResponse,
  resourceType?: string,
  resourceId?: string,
): Promise<void> {
  if (!context.idempotencyKey) return;
  const { error } = await context.admin.rpc('integration_complete_operation', {
    p_platform_id: context.platformId,
    p_operation: operation,
    p_idempotency_key: context.idempotencyKey,
    p_response_status: responseStatus,
    p_response_body: responseBody,
    p_resource_type: resourceType ?? null,
    p_resource_id: resourceId ?? null,
  });
  if (error) console.error('integration complete operation failed:', error.message);
}

async function abandonOperation(
  context: IntegrationContext,
  operation: string,
): Promise<void> {
  if (!context.idempotencyKey) return;
  const { error } = await context.admin.rpc('integration_abandon_operation', {
    p_platform_id: context.platformId,
    p_operation: operation,
    p_idempotency_key: context.idempotencyKey,
  });
  if (error) console.error('integration abandon operation failed:', error.message);
}

// ---------------------------------------------------------------------------
// Request logging (observability only)
// ---------------------------------------------------------------------------
async function logRequest(
  admin: ReturnType<typeof createAdminClient> | null,
  context: Pick<IntegrationContext, 'platformId' | 'credentialId' | 'startedAt'> | null,
  operation: string,
  statusCode: number,
  errorCode: string | null,
): Promise<void> {
  if (!admin) return;
  try {
    await admin.from('integration_request_log').insert({
      platform_id: context?.platformId ?? null,
      credential_id: context?.credentialId ?? null,
      operation,
      status_code: statusCode,
      error_code: errorCode,
      latency_ms: context ? Date.now() - context.startedAt : null,
    });
  } catch (error) {
    console.warn('integration request log failed:', error);
  }
}

// ---------------------------------------------------------------------------
// Public runner
// ---------------------------------------------------------------------------
export async function runIntegration(
  request: Request,
  options: {
    operation: string;
    idempotent: boolean;
    parseBody?: boolean;
    requireSignature?: boolean;
    handler: (context: IntegrationContext) => Promise<OperationResult>;
  },
): Promise<NextResponse> {
  const requestId = `req_${randomUUID().replace(/-/g, '')}`;
  const startedAt = Date.now();
  let context: IntegrationContext | null = null;
  let statusCode = 500;
  let errorCode: string | null = null;

  try {
    const rawBody = options.parseBody === false ? '' : await request.text();
    const requestBody = options.parseBody === false ? {} : parseBody(rawBody);

    const { admin, credential } = await authenticate(
      request.headers,
      rawBody,
      options.operation,
      { requireSignature: options.requireSignature ?? options.parseBody !== false },
    );

    context = {
      admin,
      requestId,
      platformId: credential.platform_id,
      platformCode: credential.platform_code,
      platformName: credential.platform_name,
      platformStatus: credential.platform_status,
      capabilities: credential.capabilities ?? {},
      credentialId: credential.credential_id,
      credentialMappingId: credential.mapping_id ?? null,
      environment: credential.environment,
      signingSecret: credential.signing_secret,
      idempotencyKey: request.headers.get('x-idempotency-key')?.trim() || null,
      rawBody,
      body: requestBody,
      startedAt,
    };

    if (options.idempotent) {
      if (!context.idempotencyKey) {
        throw new IntegrationError('INVALID_REQUEST', {
          detail: 'x-idempotency-key is required',
        });
      }

      const claim = await claimOperation(context, options.operation);
      if (claim?.state === 'replay' && claim.response_status !== null) {
        statusCode = claim.response_status;
        errorCode = claim.response_body?.ok === false ? 'REPLAYED_ERROR' : null;
        return jsonResponse(
          claim.response_status,
          claim.response_body ?? { ok: false, error: { code: 'INTERNAL_ERROR' } },
          requestId,
        );
      }
      if (claim?.state === 'conflict') {
        throw new IntegrationError('IDEMPOTENCY_CONFLICT');
      }
      if (claim?.state === 'in_progress') {
        throw new IntegrationError('IDEMPOTENCY_IN_PROGRESS');
      }
    }

    const result = await options.handler(context);
    const status = result.status ?? 200;
    const responseBody: StoredResponse = { ok: true, data: result.data };

    if (options.idempotent) {
      await completeOperation(
        context,
        options.operation,
        status,
        responseBody,
        result.resourceType,
        result.resourceId,
      );
    }

    statusCode = status;
    return jsonResponse(status, responseBody, requestId);
  } catch (error) {
    const mapped = mapRpcError(error);
    statusCode = mapped.status;
    errorCode = mapped.code;

    if (context && options.idempotent) {
      const stored: StoredResponse = {
        ok: false,
        error: {
          code: mapped.code,
          message: mapped.message,
          retryable: mapped.retryable,
        },
      };

      if (mapped.persist) {
        await completeOperation(context, options.operation, mapped.status, stored);
      } else {
        await abandonOperation(context, options.operation);
      }
    }

    if (mapped.detail && mapped.status >= 500) {
      console.error(`integration ${options.operation} failed:`, mapped.detail);
    }

    return errorResponse(mapped, requestId);
  } finally {
    await logRequest(context?.admin ?? null, context, options.operation, statusCode, errorCode);
  }
}

// ---------------------------------------------------------------------------
// Shared lookups
// ---------------------------------------------------------------------------
export interface ResolvedMapping {
  mapping_id: string;
  vendor_id: string | null;
  partner_id: string | null;
  status: string;
  external_vendor_id: string;
  external_branch_id: string;
  internal_location_id: string | null;
}

export async function resolveMapping(
  context: IntegrationContext,
  externalVendorId: string,
  externalBranchId: string | null,
): Promise<ResolvedMapping> {
  const { data, error } = await context.admin.rpc('integration_resolve_mapping', {
    p_platform_id: context.platformId,
    p_external_vendor_id: externalVendorId,
    p_external_branch_id: externalBranchId ?? '',
  });
  if (error) throw mapRpcError(error);

  const rows = (Array.isArray(data) ? data : data ? [data] : []) as ResolvedMapping[];
  const mapping = rows[0];
  if (!mapping) throw new IntegrationError('MAPPING_NOT_FOUND');
  if (mapping.status !== 'active') throw new IntegrationError('MAPPING_NOT_ACTIVE');
  if (!mapping.vendor_id) throw new IntegrationError('MAPPING_NOT_ACTIVE');

  // A vendor-bound credential must resolve to exactly the mapping it was
  // issued for. It cannot point at another vendor's external id.
  if (
    context.credentialMappingId &&
    mapping.mapping_id !== context.credentialMappingId
  ) {
    throw new IntegrationError('FORBIDDEN_SCOPE', {
      detail: 'credential is bound to a different mapping',
    });
  }

  return mapping;
}

export function rpcRow<T>(data: unknown): T | null {
  const rows = (Array.isArray(data) ? data : data ? [data] : []) as T[];
  return rows[0] ?? null;
}
