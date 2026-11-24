# Advertising checkout — MyFatoorah setup

Advertising is paid by card on MyFatoorah's hosted page. The campaign price is
`quote_amount_minor` for the number of six-hour periods the advertiser chose; it
is computed and stored on the server, never taken from the form.

## What you need to provide

Everything is entered in the admin panel: **Admin → Advertising → Payments**
(`/admin/advertising/payments`). Saved values live in the `system_settings` row
`advertising.myfatoorah` (admin-only).

| Field | Notes |
| --- | --- |
| API key | MyFatoorah portal → Integration Settings → API Key |
| API base URL | `https://apitest.myfatoorah.com` for test, the Qatar live URL from MyFatoorah's API Key page for production |
| Webhook secret key | Portal → Webhooks → *secure key*. The webhook route refuses events when this is missing |
| App public URL | Public origin of this app, e.g. `https://tazella.com.qa`. Used to build the callback and webhook URLs |

Environment variables (`MYFATOORAH_API_KEY`, `MYFATOORAH_BASE_URL`,
`MYFATOORAH_WEBHOOK_SECRET`, `APP_PUBLIC_URL`) are only a fallback: a value saved
in the admin panel wins. Never put these in `EXPO_PUBLIC_*` or `NEXT_PUBLIC_*`.

## What to configure in the MyFatoorah portal

1. **Webhook URL**: `https://<APP_PUBLIC_URL>/api/advertising/myfatoorah/webhook`
2. Enable the **secure key** for that webhook and copy it into
   `MYFATOORAH_WEBHOOK_SECRET`.
3. Nothing else. The browser return URL is sent per invoice
   (`/api/advertising/myfatoorah/callback`), so it does not need registering.

## Flow

1. Advertiser builds the campaign, picks a slot and the number of six-hour
   periods, and lands on checkout.
2. "Pay …" creates a MyFatoorah invoice for the quote and redirects the browser
   to the hosted payment page.
3. `advertising_start_checkout` stores the invoice id, payment URL and the
   advertiser surface on a pending `advertising_transactions` row.
4. Cash-free alternative: when the platform has granted enough promotional
   credit, the advertiser can pay from that balance instead. It is applied in
   full, server-verified by `advertising_pay_with_credit`, and needs no card.
5. Payment is confirmed from **two independent paths**, both of which re-read the
   payment from MyFatoorah before writing anything:
   - `GET /api/advertising/myfatoorah/callback` — the browser return.
   - `POST /api/advertising/myfatoorah/webhook` — signature-verified, recorded in
     `payment_events`, so a closed browser never loses a payment.
6. `advertising_confirm_payment` marks the campaign paid (idempotent), writes the
   ledger entry, and the normal approval/activation rules take over. If approval
   is not required the campaign goes live for its booked window immediately.

## Guards

- A booking window that has already ended cannot start a checkout, and
  `advertising_confirm_payment` refuses to accept money for it
  (`booking_window_expired`).
- Amounts are re-checked in the database (`amount_below_quote`); a browser
  success redirect alone can never mark a campaign paid.
- A provider reference can only settle one campaign
  (`payment_reference_already_used`).

## Testing

1. Set the test base URL and a test API key, then pay a small campaign with
   MyFatoorah's test cards.
2. Check the redirect lands on the campaign with "Payment verified".
3. Replay the same webhook (or hit the callback again): the campaign stays paid
   once, with one ledger entry.
4. Cancel a payment: the callback returns to checkout with an error and the
   campaign stays unpaid.
5. Set `MYFATOORAH_WEBHOOK_SECRET` to a wrong value: the webhook answers `401`
   and nothing changes.
