# Google Play readiness — Giftly

Sits next to [App Store notes for review](./notes-for-review.md). Sources are Google's own policy pages; the date-sensitive numbers (API level, 16 KB, closed testing) were checked in November 2026.

## 1. Account deletion URL (enter this in Play Console)

Play requires **both** an in-app path and a public web resource, with the web URL entered in Play Console's account deletion field ([requirements](https://support.google.com/googleplay/android-developer/answer/13327111), [User Data policy](https://support.google.com/googleplay/android-developer/answer/17190352)).

- Page: `/account-deletion` → production URL `https://giftly.qa/en/account-deletion` (and `/ar/account-deletion`)
- Source: `web/app/[locale]/(site)/account-deletion/page.tsx`
- Linked from the site footer ("Delete your account") and listed in `web/app/(app)/sitemap.ts`
- Static, public, no sign-in, renders in English and Arabic, gives the in-app steps, a `mailto:` request route, what is deleted, what is retained, and why vendor/enterprise/admin accounts go through support.

Verify before submitting: the URL loads signed out in a private window, the email link opens with the subject filled, and the path resolves without the locale prefix redirecting to a 404.

## 2. Financial features declaration — draft answers

Every app must complete this form on **App content**, including apps on testing tracks, and even apps with no financial features must certify that ([help](https://support.google.com/googleplay/android-developer/answer/13849271)). The question is *"Select all of the financial features the app provides."*

**Recommended:** select **Other**, then use the free-text field:

> Giftly is a marketplace for gift cards and experience vouchers from third-party businesses in Qatar. Giftly does not hold, transfer, lend or invest user funds, does not operate a wallet or stored-value account, and does not offer banking, credit, insurance, trading or money transfer. Payments for an order are collected by our licensed payment provider (MyFatoorah) at checkout and settled to the business that supplies the gift. Gift card value is redeemed only in person at the issuing business.

Why "Other" rather than "none": the app sells stored-value codes and can place a purchased card in Apple Wallet or Google Wallet. Declaring "none" while the review team can see gift-card balances and wallet buttons is exactly the kind of mismatch that produces a rejection, and the description keeps the extra review narrow. Do **not** select *Mobile payments and digital wallets* or *Rewards, points, frequent flier miles* — those describe products Giftly does not operate, and they pull in requirements (licensing, disclosures) that do not apply.

Policy context: [Financial Services](https://support.google.com/googleplay/android-developer/answer/9876821) covers “apps that expose users to deceptive or harmful financial products” — lending, banking, crypto, trading, insurance. A marketplace selling third-party retail gift cards is at the edge, not inside it; the declaration text above is what keeps it there.

## 3. Data safety form — draft answers

Complete on **App content → Data safety**. It must match what the app and its SDKs actually send off-device ([help](https://support.google.com/googleplay/android-developer/answer/10787469)). This build contains **no analytics, ads, attribution or crash-reporting SDK** (checked `package.json` and `web/package.json`), so the declaration is short and defensible.

### Collected

| Category | Data type | Collected | Shared | Processed ephemerally | Required or optional | Purpose |
| --- | --- | --- | --- | --- | --- | --- |
| Personal info | Name | Yes | No | No | Required (account) | Account management, gift delivery |
| Personal info | Email address | Yes | No | No | Required | Account, sign-in, gift delivery |
| Personal info | Phone number | Yes | No | No | Optional | Account profile, delivery questions |
| Personal info | Address | Yes | No | No | Optional | Delivery of physical rewards where a vendor offers one |
| Personal info | User IDs | Yes | No | No | Required | Account identifier |
| Financial info | Purchase history | Yes | No | No | Required | Orders, receipts, refunds, support |
| Messages | Other in-app messages | Yes | No | No | Optional | Gift messages written by the sender |
| Device or other IDs | Device or other IDs | Yes | No | No | Optional | Push notification token; wallet pass device registration |

Notes to keep the answers honest:

- **Payment info: not collected.** Card details are entered on MyFatoorah's hosted page in an in-app browser. Giftly stores a payment reference and status, which is purchase history, not payment info.
- **No location, contacts, calendar, photos, files, health, SMS, call logs, web browsing or installed apps.** There is no camera or media picker in the build.
- **No advertising or device advertising ID.** No ads declaration ("app does not contain ads").
- **Shared = No** for every row. Supabase (hosting/database), MyFatoorah (payments) and Expo's push service are service providers acting on Giftly's behalf, which the form treats as processing rather than sharing.
- **Data is encrypted in transit** — yes (HTTPS/TLS to Supabase and MyFatoorah).
- **Users can request data deletion** — yes; the form asks for the deletion request URL, use the same `/account-deletion` page.
- **Committed to the Play Families policy** — no; the app is not directed at children.

### Also declare

- **Account creation:** yes → the in-app delete path and the web deletion URL are both required, which is why §1 exists.
- **App access:** login required for wallet, checkout, sending, notifications, profile → give the reviewer `appreview@giftly.qa` and its password in the App access section, not only in free text ([prepare for review](https://support.google.com/googleplay/android-developer/answer/9859455)).
- **Ads:** no ads.
- **Content rating questionnaire:** utility/productivity or reference; no user-generated public content, no gambling, no violence. Gift messages are private, not public UGC.
- **Target audience:** 18+ or 13+; not children.
- **News app:** no. **Government app:** no. **Health:** no.
- **Permissions declaration:** none needed today — the manifest only carries `POST_NOTIFICATIONS`, which is not a restricted permission ([sensitive permissions](https://support.google.com/googleplay/android-developer/answer/16558241)).

## 4. Rejection risks that apply to Giftly

1. **Payments policy.** Play Billing is required for digital goods, not for physical goods and services ([Payments](https://support.google.com/googleplay/android-developer/answer/9858738)). Giftly's defence is that value is redeemable only in person; keep the store listing, screenshots and review notes saying “gift cards you redeem at the business”, never “balance”, “credit” or “digital wallet”. The card screen now states this in-app.
2. **Financial features declaration** wrong or missing — see §2. This is the most common Play-specific gap for gift-card apps.
3. **Account deletion web link** missing or not public — fixed by the new page; enter the URL.
4. **Data safety mismatch** — the table above is narrow because there are no analytics SDKs; if one is added later (Sentry, PostHog, Firebase), the form must change in the same release.
5. **Developer account type and closed testing.** Personal accounts created after 13 Nov 2023 must run a closed test with **12 testers opted in continuously for 14 days** before production access ([testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465)). Organisation accounts are outside that rule but need verifiable business details, usually a D-U-N-S number (allow up to 30 days). Use an organisation account.
6. **Target API level.** From 31 Aug 2026 new apps and updates must target **Android 16 (API 36)** ([requirement](https://support.google.com/googleplay/android-developer/answer/11926878)). Expo SDK 58 should generate it; confirm in the AAB, not in `app.json`.
7. **16 KB page sizes.** Apps targeting API 35+ must support 16 KB pages; updates that don't can't ship after **1 Feb 2027** ([Android docs](https://developer.android.com/guide/practices/page-sizes)). Check any native library version in the build.
8. **Metadata and IP.** Screenshots must be the real app, no “free”/“#1”/price words in name or icon, and partner brand names (Sephora, H&M, Lulu Hypermarket) need the brand-use authorization already being collected for Apple ([policy center](https://play.google/developer-content-policy)).
9. **Broken functionality.** A crash or blank first screen is the most common rejection of all. Nothing in this project has been run on Android yet — the Android build needs the same TestFlight-style dry run before upload.
10. **Enforcement.** Rejections don't hurt account standing, but removals and repeats can lead to suspension, and linked accounts get terminated together ([enforcement](https://support.google.com/googleplay/android-developer/answer/9899234)). Resubmit only after every named violation is fixed.

## 5. Order of operations

1. Confirm organisation vs personal Play account (determines the 14-day clock).
2. Upload an AAB to internal testing and run the review script on Android, including the new card screen and gift page terms in both languages.
3. Fill App content: Data safety (§3), Financial features (§2), account deletion URL (§1), App access credentials, ads, content rating, target audience.
4. Write the listing: short description, full description, screenshots (phone + tablet), feature graphic — all describing in‑person redemption.
5. Closed test if required → production access → staged rollout.
