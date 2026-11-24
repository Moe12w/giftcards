# Wallet passes — credentials and deploy runbook

How to take `supabase/functions/wallet-pass` from "not configured" to a real
`.pkpass` on an iPhone and a real card in Google Wallet. The function code is
already written and tested offline (`supabase/functions/_shared/wallet/apple.test.ts`);
everything below is the setup that cannot be done from the repo.

Until these secrets exist the endpoint answers `503 wallet_not_configured` and
the app shows "wallet passes are not available yet". Nothing else breaks.

---

## 0. What you need before you start

| Where | What |
| --- | --- |
| Apple Developer Program (paid) | Team ID, a Pass Type ID, its certificate, the Apple WWDR CA certificate |
| Google Wallet Business Console | Wallet issuer account, Issuer ID |
| Google Cloud project | Google Wallet API enabled, a service account with a JSON key |
| Supabase project | `SUPABASE_ACCESS_TOKEN` (dashboard → Account → Access Tokens) or a `supabase login` session |

Everything is set against the same Supabase project the app points at
(`EXPO_PUBLIC_SUPABASE_URL`). The commands below take `<project-ref>`, the
subdomain of that URL.

---

## 1. Apple: Pass Type ID and certificate

1. developer.apple.com → Certificates, Identifiers & Profiles → **Identifiers**
   → **Pass Type IDs** → `+`.
   - Identifier: `pass.qa.giftly.card` (or your own; it must start with `pass.`
     and match `APPLE_PASS_TYPE_ID` exactly, including case).
2. Select the new Pass Type ID → **Create Certificate** → follow the CSR flow.
3. Download the `.cer`, double-click it (it lands in Keychain as
   `Pass Type ID: pass.qa.giftly.card`), select the certificate **and its private
   key**, right-click → **Export 2 items** → `.p12`, give it a password. That
   password is `APPLE_PASS_PASSWORD` below.
4. Download the WWDR intermediate (G4 is the current one):

   ```bash
   curl -fsSLO https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer
   ```

5. Team ID: developer.apple.com → Membership → **Team ID** (10 characters).

### Convert to PEM

```bash
# certificate only (no key)
openssl pkcs12 -in pass.p12 -clcerts -nokeys -out cert.pem

# private key, decrypted (-nodes) so APPLE_PASS_PASSWORD is not needed
openssl pkcs12 -in pass.p12 -nocerts -nodes -out key.pem

# the intermediate Apple issued it under
openssl x509 -inform DER -in AppleWWDRCAG4.cer -out wwdr.pem
```

On OpenSSL 3, if the first command fails with `unsupported`/MAC errors, retry
with `-legacy`.

Check the two files belong together before uploading them — the moduli printed
below must be identical:

```bash
openssl x509 -noout -modulus -in cert.pem
openssl rsa  -noout -modulus -in key.pem
```

---

## 2. Google: issuer ID and service account

1. [Google Wallet Business Console](https://pay.google.com/business/console) →
   accept the API terms → **Get issuer ID**. A numeric string, e.g.
   `3388000000022345678`. That is `GOOGLE_WALLET_ISSUER_ID`.
2. [Google Cloud console](https://console.cloud.google.com) → create (or pick) a
   project → **APIs & Services → Library** → enable **Google Wallet API**.
3. **IAM & Admin → Service Accounts** → create one (no project roles needed) →
   **Keys → Add key → JSON** → download it. Keep this file out of the repo.
4. Back in the Wallet Business Console → **Users** → invite the service
   account's `client_email` (`...iam.gserviceaccount.com`) with **Developer**
   access, and accept the invite if Google emails one.

The gift card **class** (`<issuerId>.giftly_giftcard_v1`) is created by the
function on the first `links` call; you do not create it by hand. Its review
status is `UNDER_REVIEW`, which is fine for testing with accounts you add as
test users in the console. Public distribution needs Google's approval.

---

## 3. Set the secrets

Wrapper that turns a PEM file into one line of `\n`-escaped text (the function
accepts either form, but a single line is much safer to paste):

```bash
flatten() { awk 'NF {printf "%s\\n", $0}' "$1"; }
```

Generate the pass token secret:

```bash
openssl rand -hex 48
```

Then, with the values filled in:

```bash
export PROJECT_REF=<project-ref>

npx supabase secrets set --project-ref "$PROJECT_REF" \
  WALLET_PASS_TOKEN_SECRET='<the 96 hex chars>' \
  APPLE_PASS_TYPE_ID='pass.qa.giftly.card' \
  APPLE_TEAM_ID='<10-char team id>' \
  APPLE_PASS_CERT_PEM="$(flatten cert.pem)" \
  APPLE_PASS_KEY_PEM="$(flatten key.pem)" \
  APPLE_WWDR_CERT_PEM="$(flatten wwdr.pem)" \
  GOOGLE_WALLET_ISSUER_ID='<issuer id>' \
  GOOGLE_WALLET_SERVICE_ACCOUNT_JSON="$(base64 -w0 key.json)"
```

| Secret | Required | Notes |
| --- | --- | --- |
| `WALLET_PASS_TOKEN_SECRET` | yes | Signs each pass's web-service token. Rotating it invalidates every pass link already handed out (users re-add the pass). |
| `APPLE_PASS_TYPE_ID` | yes (Apple) | Must equal the Pass Type ID identifier, `pass.` prefix included. |
| `APPLE_TEAM_ID` | yes (Apple) | Goes into `pass.json` as `teamIdentifier`. |
| `APPLE_PASS_CERT_PEM` | yes (Apple) | The Pass Type ID certificate, PEM. |
| `APPLE_PASS_KEY_PEM` | yes (Apple) | Its private key, PEM. |
| `APPLE_WWDR_CERT_PEM` | yes (Apple) | Apple WWDR intermediate (G4). |
| `APPLE_PASS_PASSWORD` | only if the key is still encrypted | If you skipped `-nodes` above. |
| `GOOGLE_WALLET_ISSUER_ID` | yes (Google) | Numeric issuer ID. |
| `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON` | yes (Google) | Raw JSON or base64; base64 is easier to pass through a shell. |
| `WALLET_PUBLIC_BASE_URL` | optional | Overrides the base baked into `pass.json` as `webServiceURL` (default `https://<ref>.supabase.co/functions/v1/wallet-pass`). Set it only if a custom domain fronts the function. |

Apple and Google are independent: with only the Apple secrets the health check
reports `apple: true, google: false` and the Apple button works.

---

## 4. Apply the migration, then deploy

The Apple web service stores device registrations, so the table has to exist
first:

- `supabase/migrations/0159_wallet_pass_registrations.sql` — apply it through the
  Supabase SQL editor or the Management API (this repo has no local migration
  runner), and record `0159` in `supabase_migrations.schema_migrations`.

Deploy with JWT verification **off**:

```bash
npx supabase functions deploy wallet-pass --project-ref "$PROJECT_REF" --no-verify-jwt --yes
```

JWT verification must stay **off** for this function. Apple Wallet calls the
pass web service with `Authorization: ApplePass <token>` and no Supabase JWT;
the gateway would reject those calls with 401 before the function runs. The
function does its own auth: `links`/`sync` verify the caller's user JWT via
`auth.getUser`, and the Apple routes verify the per-pass HMAC token.

`supabase/config.toml` already records this as
`[functions.wallet-pass] verify_jwt = false`, so a plain
`npx supabase functions deploy wallet-pass` is safe. The `--no-verify-jwt` flag
above is belt and braces — keep using it, and never re-enable verification for
this function.

---

## 5. Check it is configured

```bash
curl -s "https://$PROJECT_REF.supabase.co/functions/v1/wallet-pass"
```

Expect:

```json
{"ok":true,"apple":true,"google":true}
```

`false` means at least one secret for that provider is missing or blank (a blank
value, not a wrong one — wrongness only shows up at signing time).

---

## 6. Produce a real pass

You need a **claimed** voucher held by a user you can sign in as. Find one:

```sql
select id, claimed_by, status, remaining_value_minor, currency
from vouchers
where claimed_by is not null
order by created_at desc
limit 5;
```

Get that user's access token (email/password sign-in against your project):

```bash
export ANON_KEY='<EXPO_PUBLIC_SUPABASE_ANON_KEY>'
export USER_JWT=$(curl -s -X POST \
  "https://$PROJECT_REF.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H 'Content-Type: application/json' \
  -d '{"email":"<user email>","password":"<password>"}' | jq -r .access_token)
```

Ask for the links:

```bash
curl -s -X POST \
  "https://$PROJECT_REF.supabase.co/functions/v1/wallet-pass" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $USER_JWT" \
  -H 'Content-Type: application/json' \
  -d '{"action":"links","voucherId":"<voucher id>"}' | jq
```

Expect `{"apple":"https://.../wallet-pass/apple/<id>/<token>","google":"https://pay.google.com/gp/v/save/..."}`.
An `appleError`/`googleError` of `not_configured` means step 3 did not take;
`provider_error` on Google means step 2 (service account access, or the Wallet
API is not enabled).

Then, in order:

1. **Apple** — open the `apple` URL in Safari **on the iPhone** (not Chrome, and
   not by copying the URL into the app; Safari is what hands `.pkpass` to
   Wallet). The sheet should say "Marajukoo — <vendor> gift card" → **Add**. The
   pass should show the vendor, balance and QR code.
2. Open the pass, tap the ⓘ → it should refresh without an error, which proves
   the web service call works (the same URL serves the rebuilt pass).
3. **Google** — open the `google` URL on the Android device (or in any browser
   signed into the same Google account) → **Save to Google Wallet** → the card
   appears in Google Wallet.
4. **In-app** — sign in as that user, open the card, tap *Add to Apple Wallet* /
   *Add to Google Wallet*. They call the same `links` action through the app's
   session, so a 401 here but not in curl means the app is running against a
   different project.
5. **Sync** — spend a little of the balance through the app's normal
   redemption path. A saved Google pass updates on its own (a PATCH runs when
   the card screen sees the balance drop). Apple passes refresh when opened.

Function output, including signing errors, is in Supabase → Edge Functions →
`wallet-pass` → Logs.

---

## 7. When it does not work

| Symptom | Cause |
| --- | --- |
| Health says `apple:false` | One of `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`, `APPLE_PASS_CERT_PEM`, `APPLE_PASS_KEY_PEM`, `APPLE_WWDR_CERT_PEM` is unset. `WALLET_PASS_TOKEN_SECRET` must also be set for the link to be produced. |
| `503 {"error":"wallet_not_configured"}` on the pass URL | Same as above. |
| `401` on the pass URL | The token no longer matches: `WALLET_PASS_TOKEN_SECRET` was changed or the voucher id in the URL is not the one the token was made for. Ask for a fresh link. |
| Logs: `APPLE_PASS_KEY_PEM could not be decrypted with APPLE_PASS_PASSWORD` | `key.pem` is still encrypted and `APPLE_PASS_PASSWORD` is missing or wrong. Export with `-nodes` and clear the password. |
| Wallet says the pass cannot be installed | The certificate is not the Pass Type ID certificate for `APPLE_PASS_TYPE_ID`, or the WWDR cert is the wrong generation (needs G4 for a current pass certificate). Check with `openssl x509 -in cert.pem -noout -subject` — it must read `Pass Type ID: pass.qa.giftly.card`. |
| Pass installs but shows no balance / stale balance | The Apple pass is rebuilt on every fetch, so a stale one means the voucher row itself is stale; pull to refresh the pass. |
| Google link missing, `googleError: "provider_error"` | The service account was not invited in the Wallet Business Console, the Google Wallet API is not enabled, or the key JSON is malformed. Logs show `google_class_failed:<status>` or `google_token_failed:<status>`. |
| Google save page: "This pass cannot be added" | `GOOGLE_WALLET_ISSUER_ID` is not the issuer that owns the class, or the signed-in Google account is not a test user while the class is `UNDER_REVIEW`. |
| Google object shows an old balance | `sync` only runs from the app after a redemption it observes; a redemption made elsewhere (admin console, vendor scanner without the app open) needs the card screen opened once. |

---

## 8. What is deliberately not here

- **No APNs push for Apple passes.** The Edge Function runtime (Deno) cannot
  open the HTTP/2 connection Apple's push endpoint requires. Passes refresh when
  the user opens them, and each fetch rebuilds the pass from the current
  voucher. Device registrations are stored in `wallet_pass_registrations` so a
  push sender can be added later without re-registering anyone.
- **No pass records in the database.** A pass is derived from its voucher plus
  the token; there is nothing to keep in sync or clean up.
