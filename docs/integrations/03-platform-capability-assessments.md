# Platform capability assessments — Snoonu, Talabat, Keeta

**Status:** investigation open. No platform endpoint, credential or capability is
verified in this repository.
**Rule:** no connector code may claim a capability that has not been confirmed
by official documentation, a sandbox, or written platform confirmation.

---

## 1. What could and could not be verified in this environment

| Check | Result |
|---|---|
| Search the repository for platform credentials/docs | None found |
| Search the repository for Snoonu/Talabat/Keeta endpoints | None found |
| Public web search from this environment | Failed (HTTP 402) |
| Official partner portal access | Not available |
| Sandbox credentials | Not available |
| Written commercial approval | Not available |

Therefore:

- **No platform API is described here as fact.**
- **No endpoint, header, payload or OAuth flow is invented.**
- The integration method for each platform remains **unknown** until the
  evidence in §5 is obtained.

The correct current state is:

```text
Snoonu   — platform_not_connected
Talabat  — platform_not_connected
Keeta    — platform_not_connected
```

---

## 2. What is known (public product level only)

These are product observations, not API capabilities:

- **Snoonu** is a Qatari delivery/marketplace app with merchant storefronts and
  in-app checkout. It is a plausible target for a native payment-method or
  checkout-extension integration, but whether it permits third-party payment
  methods is unknown.
- **Talabat** is a large GCC delivery platform (Delivery Hero group) with
  merchant partner programmes and vendor portals. It may expose merchant/order
  APIs to partners, but whether a third-party gift card can appear as a payment
  method is unknown. **Do not assume a vendor ID is returned by OAuth.**
- **Keeta** is a delivery platform expanding in the GCC. Its merchant/partner
  API surface and checkout customization options are unknown.

Nothing above justifies writing a connector.

---

## 3. Integration-method decision tree

For each platform, determine exactly one primary method (or a documented
combination):

| Method | Question to answer | Consequence |
|---|---|---|
| A. Native payment-method integration | Does the platform officially support third-party payment methods or payment-service providers? | Best customer experience; connector + platform-side configuration |
| B. Checkout extension | Does the platform allow approved extensions/plugins to add checkout functionality? | Connector + extension package |
| C. Embedded SDK | Does the platform permit third-party SDKs/UI components inside its checkout? | Connector + SDK component |
| D. Server-to-server | Will the platform engineering team implement the UI and call our API? | API + docs + certification; no UI work from us |
| E. Approved payment partner | Must we integrate through an existing payment provider/partner? | Connector through the partner; commercial agreement |

If none is available, the platform is **order-API-only or not integrable**. That
is a valid outcome and must be reported as partial integration, not failure and
not success.

---

## 4. Per-platform investigation checklist

Complete this for each platform. Every "yes" needs a document reference or a
written confirmation; every "no" is recorded as unsupported.

### 4.1 Snoonu

| Item | Status | Evidence required |
|---|---|---|
| Merchant/partner API availability | unknown | Partner portal / API docs |
| Vendor ID retrieval | unknown | API response or partner confirmation |
| Branch ID retrieval | unknown | API response or partner confirmation |
| Authentication (OAuth/API key/signed) | unknown | Auth docs |
| Order-management API | unknown | API docs + sandbox |
| Custom payment method | unknown | Written platform approval |
| Checkout extension | unknown | Extension docs + approval |
| Partial external payment | unknown | Payment lifecycle docs |
| Payment confirmation event | unknown | Event/webhook docs |
| Cancellation event | unknown | Event/webhook docs |
| Refund event | unknown | Event/webhook docs |
| Sandbox | unknown | Sandbox credentials |
| Commercial approval | unknown | Signed agreement |
| Recommended method | **undetermined** | — |

**Specific questions for Snoonu:**

1. Can a merchant offer a third-party gift card as a payment method at checkout?
2. If yes, is it a native payment method, an extension, an embedded component,
   or a server-to-server integration?
3. How is the merchant/vendor identifier obtained and verified? Is it returned
   by an authorization flow, or must the platform confirm it?
4. Are branch identifiers available, and how are they scoped?
5. What event confirms that the order is accepted and the remaining payment is
   complete?
6. Are cancellation and refund events available, and what is the refund
   allocation model?
7. Is there a sandbox, and what credentials/approvals are required?
8. What are the settlement and accounting rules for a third-party payment
   contribution?

### 4.2 Talabat

| Item | Status | Evidence required |
|---|---|---|
| Merchant/partner API availability | unknown | Partner portal / API docs |
| Vendor ID retrieval | unknown | API response or partner confirmation |
| Merchant account authorization | unknown | Auth docs |
| Branch ID retrieval | unknown | API response or partner confirmation |
| Authentication (OAuth/API key/signed) | unknown | Auth docs |
| Order-management API | unknown | API docs + sandbox |
| Custom payment method | unknown | Written platform approval |
| Checkout extension | unknown | Extension docs + approval |
| Partial external payment | unknown | Payment lifecycle docs |
| Payment confirmation event | unknown | Event/webhook docs |
| Cancellation event | unknown | Event/webhook docs |
| Refund event | unknown | Event/webhook docs |
| Sandbox | unknown | Sandbox credentials |
| Commercial approval | unknown | Signed agreement |
| Recommended method | **undetermined** | — |

**Specific questions for Talabat:**

1. Does Talabat allow a third-party gift card as a payment method, or only as a
   discount/voucher? If only a discount, what are the accounting and settlement
   differences, and is that model approved?
2. **How is the vendor ID obtained?** Do not assume OAuth returns it. If the
   merchant supplies it, what authorized mechanism verifies ownership?
3. Are branch IDs separate from vendor IDs, and how are they mapped?
4. What is the exact confirmation point for capturing the gift-card
   contribution: order accepted, payment authorized, payment captured, or
   settlement?
5. Are cancellation and refund events available? How is a partial refund
   allocated between the gift card and the platform payment?
6. Is there a sandbox and a certification checklist?
7. What are the commercial terms and technical approval steps?

### 4.3 Keeta

| Item | Status | Evidence required |
|---|---|---|
| Merchant/partner API availability | unknown | Partner portal / API docs |
| Vendor identification | unknown | API response or partner confirmation |
| Branch identification | unknown | API response or partner confirmation |
| Authentication | unknown | Auth docs |
| Order-management API | unknown | API docs + sandbox |
| Checkout customization | unknown | Written platform approval |
| Custom payment method | unknown | Written platform approval |
| Partial payment | unknown | Payment lifecycle docs |
| Payment confirmation | unknown | Event/webhook docs |
| Cancellation event | unknown | Event/webhook docs |
| Refund event | unknown | Event/webhook docs |
| Sandbox | unknown | Sandbox credentials |
| Commercial approval | unknown | Signed agreement |
| Recommended method | **undetermined** | — |

**Specific questions for Keeta:**

1. Is there a merchant/partner API for the GCC market, and what does it cover?
2. Can checkout be customized to add a payment method, or is the API
   order-management only?
3. How are merchant and branch identities represented and verified?
4. What authentication is required for server-to-server calls?
5. What event confirms a completed order and payment?
6. Are cancellation and refund events available?
7. Is a sandbox available, and what is the approval process?

---

## 5. Evidence required before a connector is written

A connector may move from `draft` to `connected` only when all of the following
exist in the repository or an approved external record:

1. **Official documentation** (URL, version/date, and the specific pages used).
2. **Written platform approval** for the integration method and the gift-card
   payment use case.
3. **Credentials** for sandbox, stored per the credential model in
   `02-integration-architecture.md`.
4. **Vendor identity mechanism** confirmed in writing.
5. **Order/payment lifecycle** confirmed: what event means "paid", what event
   means "cancelled", what event means "refunded".
6. **Sandbox test evidence** for the full lifecycle.
7. **Commercial/accounting sign-off** for payment contribution vs discount,
   settlement and refund allocation.

Without 1–7, the connector stays disabled and the platform is reported as
`platform_not_connected`.

---

## 6. Capability matrix (fill with evidence, not assumptions)

Copy this table per platform. `supported` and `verified` are separate.

| Capability | Supported | Verified | Evidence |
|---|---|---|---|
| Vendor identification | ☐ | ☐ | |
| Branch identification | ☐ | ☐ | |
| Order API | ☐ | ☐ | |
| Checkout extension / payment method | ☐ | ☐ | |
| Gift-card validation | ☐ | ☐ | |
| Partial payment | ☐ | ☐ | |
| Reservation | ☐ | ☐ | (ours; platform need not know) |
| Capture confirmation | ☐ | ☐ | |
| Cancellation events | ☐ | ☐ | |
| Refund events | ☐ | ☐ | |
| Sandbox | ☐ | ☐ | |
| Commercial approval | ☐ | ☐ | |

---

## 7. Current recommendation

1. Build the **platform-agnostic** infrastructure, SDK and sandbox now (Phases
   3–7). This does not depend on any platform.
2. Keep Snoonu, Talabat and Keeta as `draft` platform rows with all capabilities
   `supported: false, verified: false`.
3. Start the partner conversations and collect the evidence in §5.
4. Implement a connector only after the evidence exists, starting with the
   platform that offers the clearest authorized path.
5. If a platform offers only an order API, implement order ingestion and
   reporting, and label it **order-management integration only** — never
   "gift-card checkout complete".

This is the only honest and safe path. No mock response may be presented as a
live platform integration.
