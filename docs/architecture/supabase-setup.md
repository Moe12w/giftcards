# Supabase setup and deployment

Everything below targets one hosted Supabase project. The Expo app, the company
website and the three dashboards all read and write that single database.

---

## 1. What you need from your Supabase project

| Value | Where to find it | Used for |
|---|---|---|
| Project ref | the URL: `https://<ref>.supabase.co` | linking the CLI |
| Database password | Project Settings → Database → reset | `supabase link` / `db push` |
| Anon key | Project Settings → API | the app and the web dashboards |
| Service role key | Project Settings → API | Edge Functions and seeding (**server only**) |

## 2. Create `.env` (never committed)

`.env` is already in `.gitignore`. Put the public values there so the Expo app
can talk to the database:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
EXPO_PUBLIC_APP_SCHEME=giftly
```

For the CLI and the seeding scripts, add the local-only values in the same file:

```bash
SUPABASE_PROJECT_REF=<ref>
SUPABASE_DB_PASSWORD=<database password>
SUPABASE_ACCESS_TOKEN=<from supabase.com/dashboard/account/tokens>
```

> The anon key is public — it ships inside the app bundle by design. The service
> role key and the database password must never reach the app. Put the service
> role key in Edge Function secrets, not in `.env`:
>
> ```bash
> npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service role key>
> npx supabase secrets set ENTERPRISE_CODE_ENCRYPTION_KEY=<long random string>
> ```

## 2a. Authentication settings

Two settings in **Supabase Dashboard → Authentication → URL Configuration** and
**→ Sign In / Providers → Email** matter for the app.

| Setting | Value | Why |
|---|---|---|
| Redirect URLs | `giftly://**`, `http://localhost:8081/**` | the password reset email sends the user back into the app |
| Auto-confirm email | **on** while testing | without an SMTP provider the built in mailer cannot deliver, so sign ups would fail |

They can also be set through the Management API:

```bash
curl -X PATCH "https://api.supabase.com/v1/projects/<ref>/config/auth" \
  -H "Authorization: Bearer <access token>" \
  -H "Content-Type: application/json" \
  -d '{"uri_allow_list":"giftly://**,http://localhost:8081/**","mailer_autoconfirm":true}'
```

### Sending real email

Supabase's built in mailer only delivers to project team members, and only a
couple of messages per hour. For the password reset email to reach a real
customer, add your own SMTP provider (Resend, SendGrid, Postmark, …) under
**Authentication → Sign In / Providers → Email → SMTP**. Until then the reset
screen works, but the email itself is never delivered — keep the auto-confirm
setting on while developing.

## 3. Apply the migrations

### Option A — Supabase CLI (recommended)

```bash
npx supabase login                 # opens a browser for the access token
npx supabase link --project-ref <ref>
npx supabase db push                # applies every migration in order
npx supabase db lint                # optional: schema lint
```

### Option B — SQL Editor

Open the Supabase dashboard → **SQL Editor** → **New query**, and run the files
in `supabase/migrations/` **in numeric order**, `0001` → `0017`, one file per run.
This works because every file is written to be safe to run on its own.

> The order matters: `0011` renames `offers` to `products` and `0012` renames
> `gift_cards` to `vouchers`. Later files reference the new names.

## 4. Generate the enterprise code encryption key

The enterprise code inventory is encrypted at rest. One key is needed:

```sql
insert into public.system_settings (key, value, description, is_public)
values (
  'enterprise.code_encryption_key',
  jsonb_build_object('key', '<a long random string>'),
  'AES key for enterprise gift-card code encryption. Never exposed to clients.',
  false
)
on conflict (key) do update set value = excluded.value;
```

Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Only an admin can read this row (`system_settings_select` requires
`is_public or is_admin()`), and only the service role can call the
`encrypt_enterprise_code` / `decrypt_enterprise_code` functions.

## 5. Verify the deployment

```bash
# 1. The schema is present
npx supabase db push --dry-run

# 2. Nothing is left unreconciled
#    (every voucher's cached balance matches its ledger)
```

In the SQL editor:

```sql
select count(*) as inconsistent
from public.verify_voucher_balances()
where not is_consistent;

-- tables that exist
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

-- roles that are wired
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'redeem_monetary', 'redeem_sessions', 'redeem_voucher_by_code',
    'voucher_for_redemption', 'allocate_enterprise_code',
    'import_enterprise_codes', 'confirm_enterprise_redemption'
  );
```

## 6. Create the test accounts

Do this from the Supabase dashboard (**Authentication → Users → Add user**) or
with the Admin API using the service role key. Create one account per role:

| Account | Role | How to grant it |
|---|---|---|
| `customer@giftly.test` | customer | default — no role row needed |
| `owner@giftly.test` | vendor owner | `vendor_members` row with role `owner` |
| `manager@giftly.test` | vendor manager | `vendor_members` row with role `manager` |
| `staff@giftly.test` | redemption staff | `vendor_members` row with role `redemption_staff` |
| `partner@giftly.test` | enterprise user | `enterprise_members` row |
| `admin@giftly.test` | admin | `user_roles` row with role `admin` |

Example for the vendor owner:

```sql
insert into public.vendor_members (vendor_id, user_id, role)
select v.id, u.id, 'owner'
from public.vendors v, auth.users u
where v.slug = 'the-coffee-house' and u.email = 'owner@giftly.test'
on conflict do nothing;

insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'admin@giftly.test'
on conflict (user_id) do update set role = 'admin';
```

## 7. Load the demo data

`supabase/seed.sql` creates the catalogue, vendors, partners, customers,
vouchers, an enterprise code inventory and a redemption history so every
dashboard and the app have real rows to show.

```bash
# with the CLI
npx supabase db reset --linked   # re-applies migrations + seed on a dev project

# or paste supabase/seed.sql into the SQL editor
```

The seed is **generated from the mobile app's own catalogue** so the database and
the app always show the same vendors and products. After changing the app's demo
data, regenerate it:

```bash
node scripts/generate-seed.cjs
```

Test accounts created by the seed (password for all: `GiftlyTest123`):

| Email | Role |
|---|---|
| `customer@giftly.test` | customer |
| `owner@giftly.test` | vendor owner (The Coffee House + Dune Spa) |
| `manager@giftly.test` | vendor manager |
| `staff@giftly.test` | redemption staff |
| `partner@giftly.test` | enterprise partner |
| `admin@giftly.test` | platform admin |

## 8. Point the Expo app at the database

With `.env` in place, the app leaves demo mode automatically
(`hasSupabaseConfig` becomes true) and the customer area starts requiring a
sign-in. The data layer still needs its final wiring — see
`docs/architecture/phase-2-target-architecture.md`, stage 11.

## 9. Troubleshooting

| Symptom | Cause |
|---|---|
| `permission denied for table products` | the anon key is missing, or RLS is blocking an unpublished product |
| `column "banner_url" does not exist` | migrations were not applied in order — run `npx supabase db push` |
| `could not find schema public` | the schema was not created — run `0001` first |
| `enterprise code encryption key is not configured` | run step 4 |
| `user is not authenticated` | the session was not restored; check `src/lib/supabase.ts` |
