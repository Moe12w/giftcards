# Social sign-in setup — Apple and Google

Everything the app needs is already in the repository. This file lists the
dashboard work that has to exist before the buttons can produce a session, in
the order it has to be done.

What the code does:

| Provider | Implementation | Platform |
| --- | --- | --- |
| Apple | `expo-apple-authentication` native sheet → `signInWithIdToken` (`src/lib/social-auth.ts`) | iOS only |
| Google | Supabase hosted OAuth in an in-app browser session → `exchangeCodeForSession` (`src/lib/social-auth.ts`) | iOS, Android, web |

The Google button deliberately does **not** use a native Google module: the
browser flow needs only a **Web** OAuth client, so there is no iOS client, no
Android client, and no signing-key SHA-1 to keep in sync with Play App Signing.

Related code: `src/components/SocialSignInButtons.tsx` (buttons),
`app/(auth)/login.tsx` and `app/(auth)/sign-up.tsx` (where they appear),
`src/lib/auth.tsx` (`signInWithApple` / `signInWithGoogle` on the auth context),
`app.json` (`ios.usesAppleSignIn`, `expo-apple-authentication` plugin).

---

## 0. Prerequisites

- [ ] Apple Developer Program membership active.
- [ ] A Google Cloud project (the same one can later hold Maps, etc.).
- [ ] `eas init` has run, so `extra.eas.projectId` in `app.json` is a real
      project id. Social sign-in itself does not need it, but any build that can
      be tested does.
- [ ] A build to test on: Expo Go on an iOS device is enough for Apple, but a
      development build (`eas build --profile development`) is what proves the
      real bundle id works.

---

## 1. Apple Developer portal

### 1.1 App ID with the capability

- [ ] developer.apple.com → **Certificates, Identifiers & Profiles** →
      **Identifiers** → filter **App IDs**.
- [ ] Create (or open) the App ID for `qa.giftly.app`.
      *Bundle ID must be explicit, not a wildcard — Sign in with Apple does not
      work on wildcard App IDs.*
- [ ] In **Capabilities**, tick **Sign in with Apple** → **Save**.
- [ ] Leave **Server-to-Server Notification Endpoint** blank: Supabase Auth does
      not support it yet.

### 1.2 Nothing else, for a native-only app

A native iOS app that only uses the system sheet does **not** need a Services
ID, a Team ID, a Key ID, a `.p8` signing key, or the 6-monthly secret rotation —
those exist for the web OAuth flow. The Services ID block in step 3 is only
needed if you later add Sign in with Apple to the Next.js site.

### 1.3 What EAS does for you

`app.json` already has `ios.usesAppleSignIn: true` and the
`expo-apple-authentication` plugin. With EAS Build, the capability and
entitlement are applied during the build, so no manual Xcode step is needed.
Do not hand-edit `ios/` — it is generated.

---

## 2. Supabase — Apple provider

Dashboard → **Authentication** → **Providers** → **Apple** → enable.

- [ ] **Client IDs** — comma-separated list of every App ID/bundle id that will
      present an Apple ID token. For this project:

  ```
  qa.giftly.app, host.exp.Exponent, qa.giftly.app.dev
  ```

  - `qa.giftly.app` — the production/TestFlight app.
  - `host.exp.Exponent` — **required to test in Expo Go**; Expo Go presents its
    own App ID, and Apple sign-in fails without it. Remove it before launch if
    you prefer a tighter list (it cannot be abused without Expo Go installed).
  - `qa.giftly.app.dev` — only if you build a development variant with that
    bundle id. Every bundle id variant that Apple can issue a token for must be
    listed, or that build fails with an audience error.

- [ ] Leave **Services ID / Secret / Team ID / Key ID** empty while the app is
      native-only.
- [ ] Save.

Nothing in the app needs a key or a secret from this page — the ID token is
verified by Supabase against Apple's public keys.

---

## 3. Google Cloud — OAuth client

The browser flow uses Google's **web** OAuth client, so this is the only client
you create.

### 3.1 Consent screen

- [ ] console.cloud.google.com → **Google Auth Platform** → **Branding**:
      app name `Tazilla`, support email, logo, and the links Google asks for
      (homepage, privacy policy, terms).
- [ ] **Data Access (Scopes)** — keep exactly these, nothing more:
      `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
      Adding sensitive scopes triggers Google verification, which takes days
      to weeks.
- [ ] **Audience** — External (the public app). While the app is in *Testing*,
      only listed test users can sign in; **publish to production** before
      store submission.

### 3.2 OAuth client

- [ ] **Clients** → **Create client** → Application type **Web application**.
- [ ] **Authorized JavaScript origins** — add the origins that will start the
      flow. Not needed for the mobile app; add them only for the web build:
      `https://<your-site-domain>` (and `http://localhost:8081` while
      developing the Expo web build).
- [ ] **Authorized redirect URIs** — exactly one, the Supabase callback:

  ```
  https://rxrrbwnsgzpinirzme.supabase.co/auth/v1/callback
  ```

  Confirm the project ref from the provider page in the Supabase dashboard —
  do not copy it from memory.
- [ ] **Create**, then copy the **Client ID** and **Client secret**. The secret
      goes into Supabase in the next step and nowhere else: never into the app,
      `.env`, or the repository.

---

## 4. Supabase — Google provider

Dashboard → **Authentication** → **Providers** → **Google** → enable.

- [ ] **Client ID(s)** — the web client ID from step 3.2. If native Google
      sign-in is ever added, the list becomes `web, ios, android`, web first.
- [ ] **Client Secret** — the secret from step 3.2.
- [ ] **Skip nonce check** — leave off. The browser flow does not use a nonce;
      Supabase handles the PKCE verifier.
- [ ] Save.

---

## 5. Supabase — redirect URLs

Dashboard → **Authentication** → **URL Configuration**.

`Linking.createURL('auth-callback')` produces the return URL, so it changes with
how the app is run:

| How you run it | Redirect URL to allow-list |
| --- | --- |
| Release / TestFlight / production build | `giftly://auth-callback` |
| Development build | `giftly://auth-callback` (same scheme) |
| Expo Go | `exp://<host>:<port>/--/auth-callback` |

- [ ] Add `giftly://auth-callback` to **Redirect URLs**.
- [ ] For Expo Go testing only, start the app, and add the exact
      `exp://…/--/auth-callback` URL that `oauthRedirectUrl()` produces (log it
      once in `src/lib/social-auth.ts`, or read the `exp://` URL printed by
      `npx expo start`). Wildcards such as `exp://**` work during development
      but must not be left in place for launch.
- [ ] Keep **Site URL** pointing at the public web app.

The app only accepts a callback that matches
`giftly://auth-callback`/`exp://…/--/auth-callback` exactly — a crafted
`giftly://` link cannot install a session (see `completeOAuthRedirect`).

---

## 6. Account behaviour to confirm

- [ ] **Identity linking.** If a user already signed up with a password and then
      presses *Continue with Google* using the same address, Supabase links the
      provider identity to the existing account when the email is verified and
      automatic linking is enabled. Confirm the setting under
      **Authentication → Providers** / **Advanced** before launch; otherwise
      those users get a second, empty account.
- [ ] **Apple's private relay.** Users who choose *Hide My Email* get a
      `@privaterelay.appleid.com` address. Fine for sign-in, but transactional
      email to those addresses is only delivered if your sending domain is
      registered under **Services → Sign in with Apple for Email Communication**
      in the Apple portal.
- [ ] **Apple sends the name once.** `signInWithApple()` writes `full_name` to
      both `auth.users.raw_user_meta_data` and `public.profiles` on the first
      authorization only. No follow-up prompt exists, so users who skip it keep
      an empty name until they edit their profile.
- [ ] **Rate limiting.** The `auth-gate` Edge Function limits password attempts;
      provider sign-ins do not go through it. That is intended — there is no
      password to guess — but it means the per-identifier attempt ledger has no
      record of social sign-ins.

---

## 7. Store declarations to update

- [ ] **App Store Connect → App Privacy**: email address and name are still
      collected; note that they may arrive from Apple or Google. No tracking.
- [ ] **Play Console → Data safety**: same table, `shared = No`; nothing new is
      collected beyond what is already declared.
- [ ] **`docs/app-store/notes-for-review.md`**: mention that the app offers
      email/password, Apple and Google sign-in, that Sign in with Apple is
      offered because Google is, and that the review account can use either.
- [ ] Guideline 4.8 is satisfied by shipping both — Google without Apple would
      be rejected.

---

## 8. Verification checklist

Run in this order; each step needs the one above it.

- [ ] `npx tsc --noEmit` and `npx expo lint` — clean.
- [ ] iOS, Expo Go: *Continue with Apple* shows the sheet, returns to the app
      signed in, and a row appears in `public.profiles` with `full_name` set.
- [ ] iOS, development build: both buttons work.
- [ ] Android, development build: *Continue with Google* opens the browser
      sheet, completes, and lands on the customer tabs.
- [ ] Cancel each sheet — no error message is shown, and the app stays signed
      out (cancelling is not a failure).
- [ ] Sign out, sign in again with the same Apple/Google account — the same
      user id comes back (no duplicate account).
- [ ] Delete the test account from the app — it succeeds even though the account
      has no password.
- [ ] Remove `host.exp.Exponent` and any `exp://**` redirect URL from Supabase
      before the production build is submitted.

## SQL spot-checks

```sql
-- Social sign-ins create the profile through the existing trigger.
select id, email, full_name, created_at
from public.profiles
order by created_at desc
limit 5;

-- Which provider an account used.
select user_id, provider, identity_data ->> 'email' as email
from auth.identities
order by created_at desc
limit 5;
```
