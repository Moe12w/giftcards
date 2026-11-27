import { describe, expect, it, vi } from 'vitest';

import { SdkError } from './errors';
import { FetchTransport } from './transport';

function mockFetch(payload: unknown, status = 200) {
  return vi.fn(async () => ({
    ok: status < 400,
    status,
    json: async () => payload,
  })) as unknown as typeof fetch;
}

const RESERVE = {
  status: 'active',
  reservation_reference: 'RSV-ABCDEF123456',
  currency: 'QAR',
  card: { masked_code: 'GFT-••••CD34EF', vendor_name: 'Coffee' },
  balance_minor: 50000,
  reserved_minor: 15000,
  available_minor: 35000,
  order_amount_minor: 20000,
  applied_amount_minor: 15000,
  remaining_order_amount_minor: 5000,
  expires_at: '2026-11-27T12:10:00Z',
};

describe('FetchTransport', () => {
  it('calls the host backend, not Tazella, and returns the data envelope', async () => {
    const fetchImpl = mockFetch({ ok: true, request_id: 'req_1', data: RESERVE });
    const transport = new FetchTransport({
      hostBaseUrl: 'https://merchant.example/api/gift-card/',
      fetch: fetchImpl,
    });

    const result = await transport.reserve({
      external_vendor_id: 'ext-1',
      external_order_id: 'order-1',
      card_code: 'GFT-AB12CD34EF',
      order_amount_minor: 20000,
      currency: 'QAR',
      idempotency_key: 'sdk_1',
    });

    expect(result).toEqual(RESERVE);
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://merchant.example/api/gift-card/v1/reservations');
    expect((init as RequestInit).method).toBe('POST');
    expect(((init as RequestInit).headers as Record<string, string>)['X-Idempotency-Key']).toBe(
      'sdk_1',
    );
  });

  it('throws a safe SdkError for an error envelope', async () => {
    const fetchImpl = mockFetch(
      {
        ok: false,
        request_id: 'req_2',
        error: { code: 'INSUFFICIENT_BALANCE', message: 'raw server detail', retryable: false },
      },
      409,
    );
    const transport = new FetchTransport({
      hostBaseUrl: 'https://merchant.example/api/gift-card',
      fetch: fetchImpl,
    });

    await expect(
      transport.validate({ external_vendor_id: 'ext-1', card_code: 'GFT-X' }),
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_BALANCE',
      message: 'This gift card does not have enough available balance.',
      requestId: 'req_2',
      status: 409,
    });
  });

  it('has no credential parameter: secrets stay on the host backend', () => {
    const transport = new FetchTransport({ hostBaseUrl: '/api/gift-card' });
    expect(transport).toBeInstanceOf(FetchTransport);
    expect(Object.keys(transport).sort()).toEqual([
      'apiVersion',
      'baseUrl',
      'fetchImpl',
      'headers',
    ]);
  });

  it('rejects a malformed response instead of inventing data', async () => {
    const fetchImpl = mockFetch({ ok: true });
    const transport = new FetchTransport({
      hostBaseUrl: '/api/gift-card',
      fetch: fetchImpl,
    });

    await expect(
      transport.status('RSV-ABCDEF123456'),
    ).rejects.toBeInstanceOf(SdkError);
  });
});
