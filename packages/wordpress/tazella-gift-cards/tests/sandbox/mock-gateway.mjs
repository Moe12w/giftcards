/**
 * Contract-faithful stand-in for Tazella's `/api/integrations/v1/*` gateway.
 *
 * It mirrors, in plain Node with no dependencies:
 *   * `web/lib/integrations/gateway.ts` — bearer auth, `X-Timestamp` +
 *     `X-Signature` HMAC-SHA256 over `<timestamp>.<raw body>`, the 300 second
 *     skew window, `X-Platform-Code` / `X-Environment` matching, idempotency
 *     claim/replay/conflict, and the `{ request_id, ok, data | error }` envelope;
 *   * the payload and response shapes of the route handlers under
 *     `web/app/(app)/api/integrations/v1/`.
 *
 * It exists so the WooCommerce plugin can be exercised end to end on a real
 * WordPress install without a database, a Supabase project or a copy of the
 * production ledger. It is NOT a second implementation of the balance rules:
 * the real gateway decides money in Postgres RPCs, and this file only has to
 * answer the way those RPCs are documented to.
 *
 *   node mock-gateway.mjs            # listens on 127.0.0.1:9099
 *   PORT=9100 API_KEY=... SECRET=... node mock-gateway.mjs
 *
 * Test-only control endpoints live under /__test/ (reset, state, set-card,
 * fail-next-capture, fail-next-reserve). They are not part of the real API.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.PORT || 9099);
const API_KEY = process.env.API_KEY || 'tz_sandbox_wp_mock_key';
const SECRET = process.env.SECRET || 'wp_mock_secret';
const PLATFORM = process.env.PLATFORM || 'wordpress';
const ENVIRONMENT = process.env.ENVIRONMENT || 'sandbox';
const WORK_DIR = process.env.WORK_DIR || process.cwd();
const STATE_FILE = path.join(WORK_DIR, 'mock-state.json');
const LOG_FILE = path.join(WORK_DIR, 'mock-gateway.log');

const cards = {
  'SBX-GOOD': { balance: 50000, currency: 'QAR', expires: '2035-01-01T00:00:00Z' },
  'SBX-LOW': { balance: 1000, currency: 'QAR', expires: '2035-01-01T00:00:00Z' },
  'SBX-USD': { balance: 50000, currency: 'USD', expires: '2035-01-01T00:00:00Z' },
  'SBX-EXPIRED': { balance: 50000, currency: 'QAR', expires: '2020-01-01T00:00:00Z' },
};

const state = {
  reservations: {},
  redemptions: {},
  refunds: [],
  events: [],
  idempotency: {},
  requests: [],
  failNextCapture: false,
  failNextReserve: false,
  // When set, a reservation answers 201 but applies less than requested, which
  // is what a partial-balance ledger does. The plugin must refuse to mark the
  // order paid and release the hold.
  partialReserve: false,
};

function reset() {
  for (const key of Object.keys(state)) {
    if (key === 'failNextCapture' || key === 'failNextReserve' || key === 'partialReserve') {
      state[key] = false;
    } else if (Array.isArray(state[key])) {
      state[key] = [];
    } else {
      state[key] = {};
    }
  }
}

function mask(code) {
  const clean = String(code);
  return clean.length <= 8 ? clean : `${clean.slice(0, 4)}…${clean.slice(-4)}`;
}

function log(line) {
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ${line}\n`);
}

function save() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function requestId() {
  return `req_${crypto.randomUUID().replace(/-/g, '')}`;
}

function send(res, status, body, rid) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ request_id: rid, ...body }));
}

const ERRORS = {
  INVALID_REQUEST: [400, 'The request is invalid.'],
  UNAUTHORIZED: [401, 'Authentication failed.'],
  PLATFORM_NOT_ACTIVE: [403, 'This platform is not active.'],
  MAPPING_NOT_FOUND: [404, 'The business is not connected to this platform.'],
  MAPPING_NOT_ACTIVE: [403, 'The business connection is not active.'],
  CARD_NOT_FOUND: [404, 'This gift card cannot be used here.'],
  CARD_INACTIVE: [409, 'This gift card is not available for payment.'],
  CARD_EXPIRED: [409, 'This gift card has expired.'],
  CURRENCY_MISMATCH: [409, 'The currency does not match this gift card.'],
  INSUFFICIENT_BALANCE: [409, 'This gift card does not have enough available balance.'],
  RESERVATION_NOT_FOUND: [404, 'The reservation was not found.'],
  RESERVATION_NOT_CAPTURABLE: [409, 'The reservation can no longer be captured.'],
  AMOUNT_EXCEEDS_RESERVATION: [409, 'The amount exceeds the reservation.'],
  IDEMPOTENCY_CONFLICT: [409, 'The idempotency key was already used for a different request.'],
  RECONCILIATION_REQUIRED: [409, 'This payment needs manual reconciliation.'],
  REDEMPTION_NOT_FOUND: [404, 'The redemption was not found.'],
  PLATFORM_UNAVAILABLE: [503, 'The platform is temporarily unavailable.'],
  INTERNAL_ERROR: [500, 'An internal error occurred.'],
};

function fail(res, code, rid) {
  const [status, message] = ERRORS[code] || ERRORS.INTERNAL_ERROR;
  send(res, status, { ok: false, error: { code, message, retryable: status >= 500 } }, rid);
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function available(code) {
  const card = cards[code];
  if (!card) return 0;
  const reserved = Object.values(state.reservations)
    .filter((r) => r.card_code === code && r.status === 'active' && Date.parse(r.expires_at) > Date.now())
    .reduce((sum, r) => sum + r.amount_minor, 0);
  const captured = Object.values(state.redemptions)
    .filter((r) => r.card_code === code)
    .reduce((sum, r) => sum + r.amount_minor, 0);
  const refunded = state.refunds
    .filter((r) => r.card_code === code && r.status === 'completed')
    .reduce((sum, r) => sum + r.amount_minor, 0);
  return card.balance - captured - reserved + refunded;
}

function cardState(code, currency) {
  const card = cards[code];
  if (!card) return { found: false, valid: false, reason: 'not_found' };
  if (Date.parse(card.expires) < Date.now()) return { found: true, valid: false, reason: 'expired' };
  if (currency && currency !== card.currency) return { found: true, valid: false, reason: 'currency_mismatch' };
  const avail = available(code);
  if (avail <= 0) return { found: true, valid: false, reason: 'no_balance' };
  return { found: true, valid: true, reason: null, available_minor: avail, currency: card.currency };
}

const server = http.createServer(async (req, res) => {
  const rid = requestId();
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString('utf8');
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const routePath = url.pathname;

  if (routePath.startsWith('/__test/')) {
    const action = routePath.slice('/__test/'.length);
    if (action === 'reset') {
      reset();
      save();
      send(res, 200, { ok: true, data: {} }, rid);
      return;
    }
    if (action === 'state') {
      send(res, 200, { ok: true, data: state }, rid);
      return;
    }
    if (action === 'fail-next-capture') {
      state.failNextCapture = url.searchParams.get('value') !== 'false';
      send(res, 200, { ok: true, data: { failNextCapture: state.failNextCapture } }, rid);
      return;
    }
    if (action === 'fail-next-reserve') {
      state.failNextReserve = url.searchParams.get('value') !== 'false';
      send(res, 200, { ok: true, data: { failNextReserve: state.failNextReserve } }, rid);
      return;
    }
    if (action === 'partial-reserve') {
      state.partialReserve = url.searchParams.get('value') !== 'false';
      send(res, 200, { ok: true, data: { partialReserve: state.partialReserve } }, rid);
      return;
    }
    if (action === 'set-card') {
      const code = url.searchParams.get('code') || '';
      cards[code] = {
        balance: Number(url.searchParams.get('balance') || 0),
        currency: url.searchParams.get('currency') || 'QAR',
        expires: url.searchParams.get('expires') || '2035-01-01T00:00:00Z',
      };
      send(res, 200, { ok: true, data: { code, balance: cards[code].balance } }, rid);
      return;
    }
    fail(res, 'INVALID_REQUEST', rid);
    return;
  }

  const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '')?.[1]?.trim();
  const platformHeader = (req.headers['x-platform-code'] || '').trim();
  const environmentHeader = (req.headers['x-environment'] || '').trim();
  const idempotencyKey = (req.headers['x-idempotency-key'] || '').trim() || null;
  const parsedBody = (() => {
    if (!rawBody.trim()) return null;
    try {
      return JSON.parse(rawBody);
    } catch {
      return null;
    }
  })();

  state.requests.push({
    at: new Date().toISOString(),
    method: req.method,
    path: routePath,
    platform: platformHeader,
    environment: environmentHeader,
    idempotency_key: idempotencyKey,
    authorization_present: Boolean(bearer),
    body: parsedBody,
  });

  if (!bearer || bearer !== API_KEY) {
    fail(res, 'UNAUTHORIZED', rid);
    save();
    return;
  }
  if (platformHeader && platformHeader !== PLATFORM) {
    fail(res, 'UNAUTHORIZED', rid);
    save();
    return;
  }
  if (environmentHeader && environmentHeader !== ENVIRONMENT) {
    fail(res, 'UNAUTHORIZED', rid);
    save();
    return;
  }

  const isHealth = req.method === 'GET' && routePath === '/api/integrations/v1/health';
  if (!isHealth) {
    const timestamp = req.headers['x-timestamp'];
    const signature = req.headers['x-signature'];
    if (!timestamp || !signature) {
      fail(res, 'UNAUTHORIZED', rid);
      save();
      return;
    }
    if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) {
      fail(res, 'UNAUTHORIZED', rid);
      save();
      return;
    }
    const expected = crypto.createHmac('sha256', SECRET).update(`${timestamp}.${rawBody}`).digest('hex');
    const provided = String(signature).trim().toLowerCase();
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      fail(res, 'UNAUTHORIZED', rid);
      save();
      return;
    }
  }

  const body = parsedBody ?? {};
  if (rawBody.trim() && parsedBody === null) {
    fail(res, 'INVALID_REQUEST', rid);
    save();
    return;
  }

  let replay = null;
  let requestHash = null;
  if (idempotencyKey && req.method === 'POST') {
    requestHash = crypto.createHash('sha256').update(stableStringify(body)).digest('hex');
    const prior = state.idempotency[idempotencyKey];
    if (prior) {
      if (prior.hash !== requestHash) {
        fail(res, 'IDEMPOTENCY_CONFLICT', rid);
        save();
        return;
      }
      replay = prior;
    }
  }
  const remember = (status, payload) => {
    if (!requestHash || status >= 500) return;
    state.idempotency[idempotencyKey] = { hash: requestHash, status, payload };
  };

  // GET /health — the only route that skips the signature check.
  if (isHealth) {
    send(res, 200, {
      ok: true,
      data: {
        operation: 'health',
        platform: { code: PLATFORM, name: 'WordPress', status: 'active' },
        environment: ENVIRONMENT,
        capabilities: { gift_cards: true, refunds: true },
        server_time: new Date().toISOString(),
      },
    }, rid);
    return;
  }

  if (replay) {
    send(res, replay.status, { ok: true, data: replay.payload }, rid);
    return;
  }

  const route = `${req.method} ${routePath}`;

  try {
    if (route === 'POST /api/integrations/v1/gift-cards/validate') {
      const code = String(body.card_code || '').trim();
      if (!code) {
        fail(res, 'INVALID_REQUEST', rid);
        save();
        return;
      }
      const currency = body.currency ? String(body.currency).toUpperCase() : null;
      const card = cardState(code, currency);
      log(`validate ${mask(code)} -> ${card.valid ? 'valid' : card.reason}`);
      if (!card.found) {
        send(res, 200, { ok: true, data: { valid: false, reason: 'not_found' } }, rid);
        save();
        return;
      }
      send(res, 200, {
        ok: true,
        data: {
          valid: card.valid,
          reason: card.reason,
          card: { masked_code: mask(code), vendor_name: 'Mock Vendor' },
          currency: card.currency ?? cards[code].currency,
          balance_minor: card.valid ? card.available_minor : null,
          reserved_minor: 0,
          available_minor: card.valid ? card.available_minor : 0,
          expires_at: cards[code].expires,
          restrictions: { monetary_only: true, partial_allowed: true },
        },
      }, rid);
      save();
      return;
    }

    if (route === 'POST /api/integrations/v1/gift-cards/preview') {
      send(res, 200, { ok: true, data: { operation: 'preview', valid: true } }, rid);
      save();
      return;
    }

    if (route === 'POST /api/integrations/v1/reservations') {
      if (state.failNextReserve) {
        state.failNextReserve = false;
        fail(res, 'PLATFORM_UNAVAILABLE', rid);
        save();
        return;
      }
      const code = String(body.card_code || '').trim();
      const orderMinor = Number(body.order_amount_minor);
      const requested = Number(body.requested_amount_minor || body.order_amount_minor);
      const currency = String(body.currency || '').toUpperCase();
      if (!code || !Number.isInteger(orderMinor) || orderMinor <= 0 || !currency || !body.external_order_id) {
        fail(res, 'INVALID_REQUEST', rid);
        save();
        return;
      }
      const card = cardState(code, currency);
      if (!card.valid) {
        const map = {
          not_found: 'CARD_NOT_FOUND',
          expired: 'CARD_EXPIRED',
          currency_mismatch: 'CURRENCY_MISMATCH',
          no_balance: 'INSUFFICIENT_BALANCE',
        };
        fail(res, map[card.reason] || 'CARD_INACTIVE', rid);
        save();
        return;
      }
      const applied = state.partialReserve
        ? Math.max(1, Math.min(requested, card.available_minor) - 1000)
        : Math.min(requested, card.available_minor);
      if (applied < requested && !state.partialReserve) {
        fail(res, 'INSUFFICIENT_BALANCE', rid);
        save();
        return;
      }
      const reference = `rsv_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
      const ttl = Number(body.ttl_seconds || 600);
      state.reservations[reference] = {
        reference,
        card_code: code,
        amount_minor: applied,
        order_amount_minor: orderMinor,
        currency,
        external_order_id: String(body.external_order_id),
        status: 'active',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
      };
      const payload = {
        operation: 'reserve',
        status: 'active',
        reservation_reference: reference,
        currency,
        card: { masked_code: mask(code), vendor_name: 'Mock Vendor' },
        balance_minor: cards[code].balance,
        reserved_minor: applied,
        available_minor: card.available_minor - applied,
        order_amount_minor: orderMinor,
        applied_amount_minor: applied,
        remaining_order_amount_minor: orderMinor - applied,
        expires_at: state.reservations[reference].expires_at,
      };
      remember(201, payload);
      log(`reserve ${reference} order=${body.external_order_id} amount=${applied} card=${mask(code)}`);
      send(res, 201, { ok: true, data: payload }, rid);
      save();
      return;
    }

    const captureMatch = /^\/api\/integrations\/v1\/reservations\/([^/]+)\/capture$/.exec(routePath);
    if (req.method === 'POST' && captureMatch) {
      if (state.failNextCapture) {
        state.failNextCapture = false;
        fail(res, 'PLATFORM_UNAVAILABLE', rid);
        save();
        return;
      }
      const reference = decodeURIComponent(captureMatch[1]);
      const reservation = state.reservations[reference];
      if (!reservation) {
        fail(res, 'RESERVATION_NOT_FOUND', rid);
        save();
        return;
      }
      if (reservation.status !== 'active') {
        const existing = Object.values(state.redemptions).find((r) => r.reservation_reference === reference);
        if (!existing) {
          fail(res, 'RESERVATION_NOT_CAPTURABLE', rid);
          save();
          return;
        }
        const payload = {
          operation: 'capture',
          status: 'captured',
          reservation_reference: reference,
          redemption_id: existing.id,
          redemption_reference: existing.reference,
          amount_minor: existing.amount_minor,
          currency: existing.currency,
          card: { masked_code: mask(existing.card_code), vendor_name: 'Mock Vendor' },
          new_balance_minor: existing.new_balance_minor,
          captured_at: existing.captured_at,
        };
        remember(200, payload);
        send(res, 200, { ok: true, data: payload }, rid);
        save();
        return;
      }
      if (Date.parse(reservation.expires_at) < Date.now()) {
        fail(res, 'RESERVATION_NOT_CAPTURABLE', rid);
        save();
        return;
      }
      const currency = String(body.currency || '').toUpperCase();
      if (currency && currency !== reservation.currency) {
        fail(res, 'CURRENCY_MISMATCH', rid);
        save();
        return;
      }
      const confirmed = Number(body.confirmed_order_amount_minor || reservation.amount_minor);
      if (confirmed > reservation.amount_minor) {
        fail(res, 'AMOUNT_EXCEEDS_RESERVATION', rid);
        save();
        return;
      }
      const id = crypto.randomUUID();
      const redemptionReference = `ird_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
      const redemption = {
        id,
        reference: redemptionReference,
        reservation_reference: reference,
        card_code: reservation.card_code,
        amount_minor: reservation.amount_minor,
        currency: reservation.currency,
        external_order_id: reservation.external_order_id,
        external_payment_reference: body.external_payment_reference || null,
        status: 'captured',
        captured_at: new Date().toISOString(),
        new_balance_minor: available(reservation.card_code) - reservation.amount_minor,
      };
      state.redemptions[id] = redemption;
      reservation.status = 'captured';
      const payload = {
        operation: 'capture',
        status: 'captured',
        reservation_reference: reference,
        redemption_id: id,
        redemption_reference: redemptionReference,
        amount_minor: redemption.amount_minor,
        currency: redemption.currency,
        card: { masked_code: mask(redemption.card_code), vendor_name: 'Mock Vendor' },
        new_balance_minor: redemption.new_balance_minor,
        captured_at: redemption.captured_at,
      };
      remember(200, payload);
      log(`capture ${reference} -> redemption ${id} (${redemptionReference})`);
      send(res, 200, { ok: true, data: payload }, rid);
      save();
      return;
    }

    const releaseMatch = /^\/api\/integrations\/v1\/reservations\/([^/]+)\/release$/.exec(routePath);
    if (req.method === 'POST' && releaseMatch) {
      const reference = decodeURIComponent(releaseMatch[1]);
      const reservation = state.reservations[reference];
      if (!reservation) {
        fail(res, 'RESERVATION_NOT_FOUND', rid);
        save();
        return;
      }
      if (reservation.status === 'active') {
        reservation.status = 'released';
        reservation.released_at = new Date().toISOString();
        reservation.release_reason = body.reason || null;
      }
      const payload = {
        operation: 'release',
        status: reservation.status,
        reservation_reference: reference,
        released_at: reservation.released_at || null,
        release_reason: reservation.release_reason || null,
      };
      remember(200, payload);
      log(`release ${reference} status=${reservation.status} reason=${body.reason || ''}`);
      send(res, 200, { ok: true, data: payload }, rid);
      save();
      return;
    }

    const refundMatch = /^\/api\/integrations\/v1\/redemptions\/([^/]+)\/refund$/.exec(routePath);
    if (req.method === 'POST' && refundMatch) {
      const id = decodeURIComponent(refundMatch[1]);
      const amount = Number(body.amount_minor);
      const redemption = state.redemptions[id];
      if (!redemption) {
        // The real RPC is keyed by the redemption UUID, so a readable
        // reference or a reservation reference lands here.
        fail(res, 'REDEMPTION_NOT_FOUND', rid);
        save();
        return;
      }
      if (!Number.isInteger(amount) || amount <= 0) {
        fail(res, 'INVALID_REQUEST', rid);
        save();
        return;
      }
      const already = state.refunds
        .filter((r) => r.redemption_id === id)
        .reduce((sum, r) => sum + r.amount_minor, 0);
      if (already + amount > redemption.amount_minor) {
        fail(res, 'INVALID_REQUEST', rid);
        save();
        return;
      }
      const refund = {
        refund_id: crypto.randomUUID(),
        redemption_id: id,
        amount_minor: amount,
        card_code: redemption.card_code,
        currency: redemption.currency,
        reason: body.reason || null,
        status: 'completed',
        created_at: new Date().toISOString(),
      };
      state.refunds.push(refund);
      const payload = {
        operation: 'refund',
        status: 'completed',
        redemption_id: id,
        refund_id: refund.refund_id,
        amount_minor: amount,
        new_balance_minor: available(redemption.card_code),
        new_status: already + amount >= redemption.amount_minor ? 'refunded' : 'captured',
        fully_refunded: already + amount >= redemption.amount_minor,
        refunded_total_minor: already + amount,
      };
      remember(200, payload);
      log(`refund redemption=${id} amount=${amount} total=${already + amount}`);
      send(res, 200, { ok: true, data: payload }, rid);
      save();
      return;
    }

    if (route === 'POST /api/integrations/v1/orders/events') {
      state.events.push({ at: new Date().toISOString(), ...body });
      const payload = { operation: 'order_event', accepted: true, event_id: body.event_id || null };
      remember(200, payload);
      log(`event ${body.event_type} ${body.event_id}`);
      send(res, 200, { ok: true, data: payload }, rid);
      save();
      return;
    }

    const statusMatch = /^\/api\/integrations\/v1\/reservations\/([^/]+)$/.exec(routePath);
    if (req.method === 'GET' && statusMatch) {
      const reference = decodeURIComponent(statusMatch[1]);
      const reservation = state.reservations[reference];
      if (!reservation) {
        fail(res, 'RESERVATION_NOT_FOUND', rid);
        save();
        return;
      }
      send(res, 200, { ok: true, data: { operation: 'status', ...reservation } }, rid);
      save();
      return;
    }

    fail(res, 'INVALID_REQUEST', rid);
    save();
  } catch (error) {
    log(`error ${error.stack || error}`);
    fail(res, 'INTERNAL_ERROR', rid);
    save();
  }
});

server.listen(PORT, '127.0.0.1', () => {
  log(`mock gateway listening on ${PORT} platform=${PLATFORM} environment=${ENVIRONMENT}`);
  console.log(`mock gateway on http://127.0.0.1:${PORT}`);
  console.log(`api key: ${API_KEY}`);
  console.log(`signing secret: ${SECRET}`);
});
