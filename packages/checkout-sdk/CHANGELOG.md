# Changelog

## 0.1.0

- Initial source-only release.
- Framework-agnostic `GiftCardCheckoutController` with validate, preview,
  apply (reserve), remove (release), refresh and reset.
- `FetchTransport` for host-backend proxy routes; no credential or signing
  capability in the SDK.
- `SdkError` with safe public messages matching API `v1` error codes.
- Optional React hook and minimal `GiftCardPaymentMethod` component.
- Examples for a Node host proxy, vanilla browser use and React checkout.
- Unit tests for the state machine, idempotency, stale-result handling and
  envelope parsing.

Not yet included: compiled CJS/ESM `dist`, real-platform certification,
sandbox seed scenarios, and a published registry package.
