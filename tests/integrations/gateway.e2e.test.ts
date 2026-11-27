import { createHmac, randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

/**
 * Signed HTTP end-to-end tests for the gateway.
 *
 * Set INTEGRATION_BASE_URL (e.g. http://localhost:3000/api/integrations/v1)
 * and the INTEGRATION_* credential variables, or run
 * `node scripts/run-integration-e2e.mjs` which fills them from .env.local or
 * the sandbox seed defaults. Without a base URL the suite is skipped.
 */
const base = process.env.INTEGRATION_BASE_URL?.replace(/\/$/, '') ?? '';
const describeE2E = base ? describe : describe.skip;

const config = {
  key: process.env.INTEGRATION_API_KEY ?? 'tz_sandbox_mock_key_0123456789abcdef',
  secret: process.env.INTEGRATION_SIGNING_SECRET ?? 'tz_sandbox_mock_secret_0123456789abcdef',
  platform: process.env.INTEGRATION_PLATFORM_CODE ?? 'mock',
  environment: process.env.INTEGRATION_ENVIRONMENT ?? 'sandbox',
  vendor: process.env.INTEGRATION_VENDOR_ID ?? 'SBX-1001',
  branch: process.env.INTEGRATION_BRANCH_ID ?? 'SBX-1001-01',
  card: process.env.INTEGRATION_CARD_CODE ?? 'SBX-GOOD',
  expiredCard: process.env.INTEGRATION_EXPIRED_CARD ?? 'SBX-EXPIRED',
  currency: process.env.INTEGRATION_CURRENCY ?? 'QAR',
};

type Json = Record<string, unknown>;

async function signedCall(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: Json; idempotencyKey?: string; secret?: string } = {},
) {
  const method = options.method ?? 'POST';
  const raw = options.body ? JSON.stringify(options.body) : '';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const secret = options.secret ?? config.secret;
  const signature = createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex');

  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.key}`,
      'X-Platform-Code': config.platform,
      'X-Environment': config.environment,
      'X-Timestamp': timestamp,
      'X-Signature': signature,
      Accept: 'application/json',
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      ...(options.idempotencyKey ? { 'X-Idempotency-Key': options.idempotencyKey } : {}),
    },
    body: method === 'POST' ? raw : undefined,
  });

  const json = (await response.json()) as Json;
  return { status: response.status, json };
}

function data(json: Json): Json {
  return (json.data as Json) ?? {};
}

function reserveBody(card = config.card, orderId = `E2E-${randomUUID()}`) {
  return {
    external_vendor_id: config.vendor,
    external_branch_id: config.branch,
    external_order_id: orderId,
    card_code: card,
    order_amount_minor: 20000,
    requested_amount_minor: 15000,
    currency: config.currency,
    ttl_seconds: 600,
  };
}

async function releaseReservation(reference: string) {
  return signedCall(`/reservations/${encodeURIComponent(reference)}/release`, {
    body: {
      external_vendor_id: config.vendor,
      external_branch_id: config.branch,
      reason: 'e2e_cleanup',
    },
    idempotencyKey: `e2e_release_cleanup_${randomUUID()}`,
  });
}

describeE2E('signed gateway HTTP flow', { timeout: 60_000 }, () => {
  it('authenticates a signed health request', async () => {
    const result = await signedCall('/health', { method: 'GET' });
    expect(result.status).toBe(200);
    expect(result.json.ok).toBe(true);
    expect(data(result.json).platform).toMatchObject({ code: config.platform, status: 'active' });
  });

  it('rejects a bad HMAC signature', async () => {
    const result = await signedCall('/gift-cards/validate', {
      secret: 'wrong-secret',
      body: {
        external_vendor_id: config.vendor,
        external_branch_id: config.branch,
        card_code: config.card,
        currency: config.currency,
      },
    });
    expect(result.status).toBe(401);
    expect(result.json.ok).toBe(false);
  });

  it('validates a good card and reports an expired card safely', async () => {
    const good = await signedCall('/gift-cards/validate', {
      body: {
        external_vendor_id: config.vendor,
        external_branch_id: config.branch,
        card_code: config.card,
        currency: config.currency,
      },
    });
    expect(good.status).toBe(200);
    expect(data(good.json).valid).toBe(true);

    const expired = await signedCall('/gift-cards/validate', {
      body: {
        external_vendor_id: config.vendor,
        external_branch_id: config.branch,
        card_code: config.expiredCard,
        currency: config.currency,
      },
    });
    expect(expired.status).toBe(200);
    expect(data(expired.json).valid).toBe(false);
    expect(data(expired.json).reason).toBe('expired');
  });

  it('previews the eligible amount without creating a hold', async () => {
    const preview = await signedCall('/gift-cards/preview', {
      body: {
        external_vendor_id: config.vendor,
        external_branch_id: config.branch,
        card_code: config.card,
        currency: config.currency,
        order_amount_minor: 20000,
        requested_amount_minor: 15000,
      },
    });
    expect(preview.status).toBe(200);
    expect(Number(data(preview.json).applied_amount_minor)).toBe(15000);
  });

  it('reserves, reads status, captures, and refunds an external payment', async () => {
    const body = reserveBody();
    const reserve = await signedCall('/reservations', {
      body,
      idempotencyKey: `e2e_reserve_${randomUUID()}`,
    });
    expect(reserve.status).toBe(201);
    const reference = String(data(reserve.json).reservation_reference);
    expect(reference).toMatch(/^RSV-/);

    const status = await signedCall(`/reservations/${encodeURIComponent(reference)}`, {
      method: 'GET',
    });
    expect(status.status).toBe(200);
    expect(data(status.json).status).toBe('active');

    const capture = await signedCall(
      `/reservations/${encodeURIComponent(reference)}/capture`,
      {
        body: {
          external_vendor_id: config.vendor,
          external_branch_id: config.branch,
          external_payment_reference: `e2e-pay-${randomUUID()}`,
          confirmed_order_amount_minor: 20000,
          currency: config.currency,
        },
        idempotencyKey: `e2e_capture_${randomUUID()}`,
      },
    );
    expect(capture.status).toBe(200);
    expect(data(capture.json).status).toBe('captured');
    const redemptionId = String(data(capture.json).redemption_id);
    expect(redemptionId).toMatch(/^[0-9a-f-]+$/i);

    const refund = await signedCall(`/redemptions/${redemptionId}/refund`, {
      body: {
        external_vendor_id: config.vendor,
        external_branch_id: config.branch,
        amount_minor: 15000,
        reason: 'e2e_refund',
      },
      idempotencyKey: `e2e_refund_${randomUUID()}`,
    });
    expect(refund.status).toBe(200);
    expect(data(refund.json).fully_refunded).toBe(true);
  });

  it('releases an uncaptured hold and records status', async () => {
    const reserve = await signedCall('/reservations', {
      body: reserveBody(),
      idempotencyKey: `e2e_reserve_release_${randomUUID()}`,
    });
    expect(reserve.status).toBe(201);
    const reference = String(data(reserve.json).reservation_reference);

    const release = await releaseReservation(reference);
    expect(release.status).toBe(200);
    expect(data(release.json).status).toBe('released');
  });

  it('replays an idempotent reserve and rejects a conflicting key', async () => {
    const key = `e2e_idem_${randomUUID()}`;
    const body = reserveBody();
    const first = await signedCall('/reservations', { body, idempotencyKey: key });
    expect(first.status).toBe(201);
    const reference = String(data(first.json).reservation_reference);

    const replay = await signedCall('/reservations', { body, idempotencyKey: key });
    expect(replay.status).toBe(201);
    expect(data(replay.json).reservation_reference).toBe(reference);

    const conflict = await signedCall('/reservations', {
      body: { ...body, requested_amount_minor: 10000 },
      idempotencyKey: key,
    });
    expect(conflict.status).toBe(409);
    expect((conflict.json.error as Json).code).toBe('IDEMPOTENCY_CONFLICT');

    await releaseReservation(reference);
  });

  it('deduplicates verified order events', async () => {
    const event = {
      event_id: `e2e_evt_${randomUUID()}`,
      event_type: 'order.paid',
      external_order_id: `E2E-EVENT-${randomUUID()}`,
      amount_minor: 20000,
      currency: config.currency,
    };
    const key = `e2e_event_${randomUUID()}`;

    const first = await signedCall('/orders/events', { body: event, idempotencyKey: key });
    expect(first.status).toBe(200);
    expect(data(first.json).duplicate).toBe(false);

    const second = await signedCall('/orders/events', {
      body: event,
      idempotencyKey: `e2e_event_${randomUUID()}`,
    });
    expect(second.status).toBe(200);
    expect(data(second.json).duplicate).toBe(true);
  });
});
