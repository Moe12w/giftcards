# Glossary

Plain-English meanings of the words used in this codebase.

| Term | Meaning |
|---|---|
| **Account** | A Supabase login (email + password) |
| **Profile** | Public details attached to an account |
| **Role** | What a person is allowed to do (customer, vendor owner, manager, admin, etc.) |
| **Tenant** | One business's data; one vendor or one partner |
| **RLS** | Row Level Security — database rules that hide other people's data |
| **RPC** | A named database function the app can call |
| **SECURITY DEFINER** | A function that runs with database-owner rights; used for safe writes |
| **Service role** | A secret server key that bypasses RLS; never used in the browser |
| **Edge Function** | Server code running in Supabase, used for payments and webhooks |
| **Server action** | Server code called by a Next.js form |
| **Minor units** | Money stored as integers: 100 fils = 1 QAR |
| **Supplier** | A vendor or enterprise partner as a MyFatoorah sub-merchant |
| **SupplierCode** | Permanent ID linking a Tazilla business to MyFatoorah |
| **Supplier allocation** | Splitting an invoice amount to one or more suppliers |
| **InvoiceShare** | Amount assigned to a supplier inside a MyFatoorah invoice |
| **ProposedShare / ProposedDepositShare** | Provider commission fields we deliberately do not use |
| **Provider-managed commission** | MyFatoorah's own configuration decides fees; Tazilla does not deduct another commission |
| **KYC** | Identity/business verification MyFatoorah performs on a supplier |
| **Payment eligibility** | Tazilla's own switch that allows a business to receive live payments |
| **Webhook** | Server-to-server notification from MyFatoorah |
| **Idempotency** | Doing the same request twice has the same effect as doing it once |
| **Ledger** | Immutable record of money in and out |
| **Settlement** | Provider deposit to a supplier; recorded manually in Tazilla |
| **Voucher** | An issued gift card instance |
| **Enterprise partner** | A business that brings codes it issues itself (Sephora, H&M, Lulu Hypermarket); Tazilla lists and sells them but does not resell them |
| **Vendor** | A business whose gift cards Tazilla issues and whose staff redeem them in the Tazilla system |
| **Enterprise code** | A code issued by an enterprise partner (not Tazilla), stored encrypted and revealed to the buyer |
| **Shell vendor** | Hidden vendor row used so enterprise partners can advertise |
| **Basket** | Client-side list of bulk offers before checkout |
| **Placement** | An advertising area, such as homepage hero or a category carousel |
| **Slot** | Numbered advertising position inside a placement |
| **Period** | One 6-hour advertising booking block |
| **Hold** | 2-minute reservation of a slot during checkout |
| **Campaign** | One paid advertising booking |
| **Creative** | The ad content and where it links |
| **Impression / click / conversion** | Advertising tracking events |
| **Promotional credit** | Admin-granted balance used to pay for advertising |
| **Maintenance** | Scheduled job that expires, completes and activates campaigns |
| **MCP** | Protocol that lets AI assistants call Tazilla tools |
| **Tool** | One callable MCP function |
| **Tenant isolation** | Ensuring one business cannot see another's data |
| **Audit trail** | Permanent log of sensitive actions |
