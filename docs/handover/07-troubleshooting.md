# Troubleshooting

## Payment did not complete

1. Check the order in `/admin/orders` or `myfatoorah_payments`.
2. Look at `webhook_events` for the event id and `processed_at`.
3. Check the Vercel runtime logs for `/api/merchant-payment/confirm`.
4. Re-query MyFatoorah `GetPaymentStatus` with the invoice id.
5. Do **not** manually mark the order paid unless the provider confirms paid and the webhook has been verified.

## Supplier status is stuck

- Press **Sync provider status** on the vendor/partner detail page.
- Check `myfatoorah_supplier_code` exists.
- Check provider status in MyFatoorah portal.
- Check `payment_eligibility` is enabled in Giftly.
- Rejection comments are shown on the admin page.

## Document submission failed

- Check the document's `provider_submission_status` and `provider_last_error`.
- Press **Submit to MyFatoorah** again.
- Confirm format (PDF/PNG/JPG) and size (max 5 MB).
- Internal review status and provider submission status are separate; fixing one does not change the other.

## Admin pages say "Supabase key" error

Those pages use `SUPABASE_SERVICE_ROLE_KEY`. Confirm it is set in Vercel for Production and that a redeploy happened after adding it.

## Bulk checkout button does nothing

- Confirm `create-bulk-payment` is deployed and ACTIVE.
- Confirm the buying account is approved.
- Confirm the selling vendor/partner is Active and admin-enabled.
- Check browser console/network for `supplier_not_ready` or `invalid_quantity`.

## MCP tools list is missing payment tools

Redeploy `mcp` with `--no-verify-jwt`, then use your MCP client's `tools/list` call against
`https://rxrrbznwnsgzpinirzme.supabase.co/functions/v1/mcp`. The nine expected tools are listed in
`docs/handover/00-START-HERE.md` and `supabase/functions/mcp/README.md`.

## Advertising payment not confirmed

Advertising uses its own webhook and settings:
- `/api/advertising/myfatoorah/webhook`
- `system_settings['advertising.myfatoorah']`

Do not confuse them with gift-card payments (`payments.myfatoorah` and the `payment-webhook` Edge Function).

## Advertising campaign not showing

Check:
- payment status is `paid`,
- approval is approved,
- campaign status is `active` or `scheduled` with start time passed,
- placement is active and not paused,
- slot number is set (drafts are slotless),
- creative is present.

Run advertising maintenance if a scheduled campaign should have activated.

## Support ticket missing from customer's app

Older tickets may have `customer_id = null`. Those are only visible to admins. New tickets set `customer_id` from the signed-in user.

## Build or typecheck fails

- Run `npx tsc --noEmit --incremental false` in `web/`.
- If `.next/types/cache-life.d.ts` reports an invalid character, delete `web/.next` and retry.
- Confirm Node 22+.

## Edge Function changes not reflected

Deploy the function again. Internal functions need `--no-verify-jwt`; `create-payment` and `create-bulk-payment` do not.

## SQL changes not reflected

Apply the migration through the Management API, then record its version in `supabase_migrations.schema_migrations`.
