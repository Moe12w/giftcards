# Setup and deployment

## What you need

- Node.js 22 or newer (24 works)
- `npm`
- Supabase CLI (`npx supabase` works even without a global install)
- Vercel CLI (`vercel`)
- Git (installed on this machine)
- Access to the Supabase project `rxrrbznwnsgzpinirzme`
- Access to the Vercel project `giftcards`

## Local environment files

Secrets are kept out of Git.

Root `.env` is used by the Expo app:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_APP_SCHEME`
- `SUPABASE_ACCESS_TOKEN` (for applying migrations)
- `SUPABASE_PROJECT_REF`

`web/.env.local` is used by the website:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Never commit either file. They are gitignored.

## Production environment variables in Vercel

| Name | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `NEXT_PUBLIC_SITE_URL` | Public site URL (`https://giftcards-jade.vercel.app`) |
| `SUPABASE_URL` | Server-side Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret server key used by admin pages and account creation |
| `CRON_SECRET` | Protects scheduled endpoints |

MyFatoorah keys do **not** go in Vercel. Admins enter them in Admin → Payment management; they are stored in `system_settings`.

## Common commands

Run from the repository root:

From the repository root:

```bash
# Tests
npm test

# Check Expo/TypeScript
npx tsc --noEmit

# List deployed Edge Functions
npx supabase functions list --project-ref rxrrbznwnsgzpinirzme

# Deploy web to Vercel production
vercel --prod --yes
```

From `web/`:

```bash
# Check web TypeScript
npx tsc --noEmit --incremental false

# Build web
npm run build
```

SQL migrations are applied through the Supabase Management API or SQL editor; there is no repo-local helper script. After applying one, record its version in `supabase_migrations.schema_migrations`.

## Deploying Edge Functions

Currently deployed functions:
- `mcp`
- `supplier-onboard`
- `upload-supplier-document`
- `sync-myfatoorah-suppliers`
- `create-payment`
- `create-bulk-payment`
- `create-basket-payment`
- `payment-webhook`

Most are internal and are called with a service-role header, so they must be deployed with JWT verification **off**:

```bash
npx supabase functions deploy supplier-onboard upload-supplier-document sync-myfatoorah-suppliers payment-webhook --no-verify-jwt --yes
```

`create-payment`, `create-bulk-payment` and `create-basket-payment` are called from browsers with a user JWT, so they keep JWT verification **on**:

```bash
npx supabase functions deploy create-payment create-bulk-payment create-basket-payment --yes
```

`mcp` is public for catalogue reads:

```bash
npx supabase functions deploy mcp --no-verify-jwt --yes
```

## Supabase secrets

Set these in Supabase → Edge Functions → Secrets if they are not present:

- `MYFATOORAH_API_KEY`
- `MYFATOORAH_WEBHOOK_SECRET`
- `APP_PUBLIC_URL`
- `MYFATOORAH_BASE_URL` (optional; defaults to `https://apitest.myfatoorah.com`)
- `GIFTLY_SITE_URL` (optional; MCP fallback)

The admin-entered settings in `system_settings` take priority over these secrets.

## Scheduled work

`web/vercel.json` calls `/api/cron` daily at `00:05 UTC`. That job:
- delivers scheduled gifts,
- runs advertising maintenance,
- syncs MyFatoorah supplier statuses.

## Migration rules

- Never edit a migration that has already been applied. Add a new numbered file instead.
- After applying a migration, insert its version into `supabase_migrations.schema_migrations` so future pushes skip it.
- The CLI cannot connect to the hosted database directly here; migrations are applied through the Supabase Management API.
