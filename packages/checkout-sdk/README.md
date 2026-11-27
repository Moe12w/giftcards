# @tazella/checkout-sdk

Framework-agnostic gift-card payment method for external checkout apps.

**Status:** `0.1.0`, early infrastructure. Compatible with Tazella integration
API `v1`. It is not certified against any live third-party platform checkout.

## Trust boundary

The SDK **never** holds a platform API key or signing secret, and **never**
decides validity, ownership, balance or capture. It talks only to the host
platform's backend; that backend signs and forwards requests to Tazella's
gateway. Capture and refund stay backend decisions — the SDK learns about a
capture through `refresh()`.

```text
browser SDK → host backend (holds secret) → Tazella gateway → Postgres RPC
```

## Install / consume

The package is delivered as typed ESM source (no runtime dependencies). Copy it
into the platform repository or point the platform bundler at `src/index.ts`
and `src/react/index.ts`. A compiled `dist` with CJS output is added when the
API contract is frozen at `1.0`.

```ts
import {
  FetchTransport,
  GiftCardCheckoutController,
} from '@tazella/checkout-sdk';

const transport = new FetchTransport({
  hostBaseUrl: '/api/gift-card', // YOUR backend, not Tazella
});

const controller = new GiftCardCheckoutController(transport, {
  externalVendorId: '55671',
  externalBranchId: '55671-02',
  externalOrderId: 'PLATFORM-998877',
  currency: 'QAR',
  orderAmountMinor: 20000,
});
```

`FetchTransport` expects the host backend to expose these proxy routes under
`{hostBaseUrl}/v1`:

| Method | Path | Forwards to Tazella |
|---|---|---|
| POST | `/gift-cards/validate` | `POST /gift-cards/validate` |
| POST | `/gift-cards/preview` | `POST /gift-cards/preview` |
| POST | `/reservations` | `POST /reservations` |
| POST | `/reservations/{ref}/release` | `POST /reservations/{ref}/release` |
| GET | `/reservations/{ref}` | `GET /reservations/{ref}` |

See `examples/node-server.ts` for the signing and credential handling on the
host side. A custom `GiftCardTransport` can replace `FetchTransport` entirely.

## State machine

```text
idle → validating → invalid | valid → applying → applied → removing → idle
                                                       ↓
                                                  completed (via refresh)
                                       any step → error → retry/reset
```

- One in-flight request at a time; duplicate submits share the same promise.
- The applied amount is always `applied_amount_minor` from Tazella.
- Reserve and release use idempotency keys generated once per operation.
- `isExpired(state, nowIso)` reads the backend `expires_at`; the controller
  never starts its own countdown.
- `reset()` ignores stale async results.

## React

```tsx
import { GiftCardPaymentMethod } from '@tazella/checkout-sdk/react';

<GiftCardPaymentMethod controller={controller} refreshIntervalMs={30000} />;
```

The component is deliberately minimal and takes host classes, labels and CSS
variables. It supports `dir="auto"` for Arabic and does not impose a visual
identity. If the host already has an order-event stream, leave
`refreshIntervalMs` at `0` and call `controller.refresh()` from that stream.

## Errors

`SdkError` exposes `code`, `retryable`, `requestId` and `status`. Messages are
safe for display; raw gateway details are not used as UI copy. The error codes
match `docs/integrations/02-integration-architecture.md` §5.5.

## Safety notes

- Do not put a Tazella credential, signing secret, full card code or buyer
  identity in this package or in a browser bundle.
- Do not call `capture` or `refund` from client code. Those operations belong to
  the host backend after its own order/payment verification.
- Sandbox and production credentials are separate in the gateway; keep them
  separate in the host backend too.

## Development

```bash
npm test          # from the repository root (vitest includes this package)
npm run typecheck # from this directory
```
