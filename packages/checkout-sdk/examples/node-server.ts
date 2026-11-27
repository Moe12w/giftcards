/**
 * Example host-backend proxy.
 *
 * This is the ONLY place the Tazella API key and signing secret live. The
 * browser SDK calls these endpoints; they forward to the Tazella gateway with
 * the platform credential and a fresh HMAC signature.
 *
 * Adapt the response helper to your framework (Next.js route handlers, Express,
 * Hono, etc.). No framework is imported here on purpose.
 */
import { createHmac } from 'node:crypto';

const GATEWAY = 'https://tazella.com.qa/api/integrations/v1';

interface ProxyConfig {
  platformCode: string;
  environment: 'sandbox' | 'production';
  apiKey: string;
  signingSecret: string;
  fetch?: typeof fetch;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function createHostProxy(config: ProxyConfig) {
  const fetchImpl = config.fetch ?? globalThis.fetch;

  async function forward(
    path: string,
    method: 'GET' | 'POST',
    body: unknown,
    idempotencyKey?: string,
  ) {
    const rawBody = body === undefined ? '' : JSON.stringify(body);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', config.signingSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const response = await fetchImpl(`${GATEWAY}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'X-Platform-Code': config.platformCode,
        'X-Environment': config.environment,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
        ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: method === 'POST' ? rawBody : undefined,
    });

    const payload = await response.json();
    return json(payload, response.status);
  }

  return {
    validate: (body: unknown) => forward('/gift-cards/validate', 'POST', body),
    preview: (body: unknown) => forward('/gift-cards/preview', 'POST', body),
    reserve: ({ idempotency_key, ...body }: { idempotency_key: string } & Record<string, unknown>) =>
      forward('/reservations', 'POST', body, idempotency_key),
    release: (
      reference: string,
      { idempotency_key, ...body }: { idempotency_key: string } & Record<string, unknown>,
    ) =>
      forward(
        `/reservations/${encodeURIComponent(reference)}/release`,
        'POST',
        body,
        idempotency_key,
      ),
    status: (reference: string) => forward(`/reservations/${encodeURIComponent(reference)}`, 'GET', undefined),
  };
}

/* Example wiring (pseudocode):
 *
 * const proxy = createHostProxy({
 *   platformCode: 'snoonu',
 *   environment: 'sandbox',
 *   apiKey: process.env.TAZELLA_API_KEY!,
 *   signingSecret: process.env.TAZELLA_SIGNING_SECRET!,
 * });
 *
 * // POST /api/gift-card/v1/reservations
 * // const response = await proxy.reserve(await request.json());
 */
