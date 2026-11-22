# App Store Notes for Review — Giftly

Paste the section below into App Store Connect → App Information → **Notes for Review**. Replace every `[[…]]` placeholder first: demo account email and password, support email, and review phone number.

## Paste this

Giftly is a marketplace for gift cards from businesses in Qatar. A customer buys a gift card for a specific business, sends it to someone (or keeps it), and the recipient redeems it in person at that business. The app has no digital content, no subscriptions and no in-app purchases.

**Two kinds of gift.** Most cards are issued by the business and redeemed by showing a QR code at its counter. A few partner gift cards (for example a department store) carry a code issued by that partner; the recipient shows the code to staff at the partner's store, where it is redeemed. Neither kind can be spent inside the app.

**How a purchase works.** Gift cards can only be spent on real-world goods and services at the business that issued them — coffee, meals, spa treatments, gym sessions, cinema tickets, retail purchases. Checkout leaves the app and opens the business's payment page hosted by MyFatoorah (our payment provider) in a secure in-app browser; we never collect card details inside the app. This is the payment path Apple allows for goods and services consumed outside the app (Guideline 3.1.3(e)), which is why no In-App Purchase is used. Gift card value cannot be converted to cash, is not an open-loop payment instrument, and cannot be used to unlock anything inside the app.

**Browsing without an account.** Browsing the marketplace, search, categories, business pages and gift details work without signing in. Signing in is only required for account features: the wallet of owned cards, baskets, checkout, sending gifts, notifications and personal data. Onboarding finishes in the marketplace rather than forcing a login.

**What to review**

1. Launch the app and browse without signing in.
2. Sign in with the demo account below.
3. Open **My cards** — the demo account already holds a card, with its balance, expiry and a QR code that staff scan at the business.
4. Buy a card: choose a business → value → personalise → checkout. The hosted payment page opens in-app; see the payment note below.
5. Send a gift to any email address, or open a card and use **Send** to produce a claim link. The recipient can open the link without the app installed.
6. Profile → **Delete account**: the account and its personal data are deleted immediately in-app, and the session is signed out. What remains afterwards is limited to financial records we must retain (orders and issued cards), detached from the personal profile.

**Demo account**

- Email: `[[demo-review@giftly.qa]]`
- Password: `[[…]]`

**Payments during review.** Payments are live rather than sandboxed. If you would prefer not to make a real purchase, tell us and we will issue a card to the demo account for inspection instead; the wallet, QR, send, claim and redemption screens can all be reviewed without paying.

**Apple Wallet / Google Wallet.** Cards can optionally be added to Apple Wallet or Google Wallet. This is a convenience for a card the customer has already bought, not a product for sale, and it is behind our server configuration — if it is not available for your review build, the buttons show a short "not available yet" message and everything else works normally.

**Push notifications.** Optional. The app asks from the Notifications screen with an explanation, not on launch or sign-in, and a refusal changes nothing.

**No account creation from review.** If you would rather not create an account, the demo account above has the customer role and no payment method attached.

**Contact.** `[[support@giftly.qa]]` · `[[+974 …]]`

## Where each claim comes from

| Claim | Evidence in the app |
| --- | --- |
| Hosted payment page, no card details in the app | `app/(customer)/checkout/payment.tsx` opens a MyFatoorah invoice in an in-app browser |
| Browsing works signed out | `app/(customer)/(tabs)` is public; account routes are wrapped in a sign-in gate |
| Cards show balance, expiry and QR | `app/(customer)/card/[id].tsx` |
| Sending produces a claim link | `src/lib/claim-link.ts`, `app/(customer)/notifications/[id].tsx` |
| Account deletion is in-app and immediate | `app/(customer)/profile/delete.tsx` (Profile → Delete account) calls the `delete_my_account` RPC, then signs out |
| Wallet passes are a convenience, not a purchase | `src/lib/wallet-pass.ts` and `supabase/functions/wallet-pass`; returns `wallet_not_configured` until credentials are set |
| Partner codes are redeemed in store, not online | `app/(customer)/card/[id].tsx` partner-code block; `src/i18n/en.json` `cards.partnerCodeHint` and `business.partnerGiftBody` |
| Push is primed, not requested at launch | `src/lib/push.ts` never prompts on sign-in; `app/(customer)/notifications/index.tsx` shows the priming card |

## Before submitting

- The demo account must exist with a card in its wallet, otherwise rewrite step 3.
- Wallet buttons say "not available yet" until the Apple and Google credentials in `docs/wallet-pass-setup.md` are set. Either finish them or keep the wording above.
- Do not advertise Apple/Google Wallet in the store listing copy until passes work on a device.
