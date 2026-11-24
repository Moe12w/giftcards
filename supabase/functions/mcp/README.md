# Tazilla MCP server

A separate Supabase Edge Function that exposes the Tazilla gift-card catalogue to
MCP-compatible AI assistants over **Streamable HTTP**. It does not touch the
Expo app or its startup.

## Endpoint

```
https://rxrrbznwnsgzpinirzme.supabase.co/functions/v1/mcp
```

The endpoint is stateless. It accepts JSON-RPC `POST` requests and returns JSON
(no server-sent event stream). `GET` returns `405`; `DELETE` returns `204`.

## Deploy

1. Apply the additive migration `supabase/migrations/0107_mcp_rate_limits.sql`
   (rate-limit table + helper). No existing table is changed.
2. Deploy the function **without gateway JWT verification**:

   ```bash
   supabase functions deploy mcp --no-verify-jwt --project-ref rxrrbznwnsgzpinirzme
   ```

   Public read tools must be reachable without a Supabase key. The function
   verifies customer JWTs itself for the two order tools.

3. Optional: set `TAZILLA_SITE_URL` (for example `https://tazilla.com.qa`) if the
   public site URL differs from the fallback. `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` are provided by the Edge Function runtime.

Payment links are created through MyFatoorah's v2 `SendPayment` endpoint using admin-managed credentials. The MCP function never sees card data and never returns supplier codes or raw provider responses. Issuance still happens through the verified payment webhook, not directly from these tools.

## Tools

| Tool | Auth | Purpose |
| --- | --- | --- |
| `search_businesses` | Public | Find approved businesses by name, description, city, area or gift-card name. |
| `get_business_details` | Public | Business profile, contact links, gift cards, terms, expiry and redemption policies. |
| `get_gift_cards` | Public | All published gift cards for one business, with amounts/packages and prices. |
| `get_gift_card_details` | Public | One gift card in full, including denominations, restrictions and buying guidance. |
| `create_gift_card_order` | Customer JWT | Prepare a pending order. Server validates the catalogue and calculates the price. No payment. |
| `check_order_status` | Customer JWT | Read one order belonging to the signed-in customer. |
| `create_payment_link` | Customer JWT | Turn a pending order into a secure MyFatoorah link. Returns the URL, amount and expiry. Reuses an active link for the same idempotency key. |
| `get_payment_link` | Customer JWT | Read link/order payment status (`active`, `paid`, `expired`, `cancelled`). |
| `send_payment_link` | Customer JWT | Create a link and optionally ask MyFatoorah to email/SMS it. Default `link` just returns the URL for the assistant to share. |

### Customer authentication

Send the customer's Supabase access token:

```
Authorization: Bearer <customer access token>
```

All order and payment-link tools filter every query by `buyer_id = auth user id`.
A missing or invalid token returns a tool error with code `auth_required`; no
order data is returned. Link creation/sending is rate-limited to 5/minute/user
and status reads to 60/minute/user via `mcp_rate_limits`.

## Client configuration

Most MCP clients accept a remote HTTP server entry:

```json
{
  "mcpServers": {
    "tazilla": {
      "type": "http",
      "url": "https://rxrrbznwnsgzpinirzme.supabase.co/functions/v1/mcp"
    }
  }
}
```

For the order tools, add the customer token:

```json
{
  "mcpServers": {
    "tazilla": {
      "type": "http",
      "url": "https://rxrrbznwnsgzpinirzme.supabase.co/functions/v1/mcp",
      "headers": {
        "Authorization": "Bearer <customer access token>"
      }
    }
  }
}
```

ChatGPT and Claude can only be described as compatible once their connector
has been configured and tested. The server follows the MCP Streamable HTTP
transport, but platform availability is not claimed here.

## Quick test

Initialize:

```bash
curl -sS https://rxrrbznwnsgzpinirzme.supabase.co/functions/v1/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}}}'
```

List tools:

```bash
curl -sS https://rxrrbznwnsgzpinirzme.supabase.co/functions/v1/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

Search:

```bash
curl -sS https://rxrrbznwnsgzpinirzme.supabase.co/functions/v1/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_businesses","arguments":{"query":"spa","city":"Doha","limit":5}}}'
```

## Security notes

- The service-role key is read only inside the Edge Function and is never
  returned to a client.
- Every tool argument is validated (UUIDs, lengths, enums, email, phone, date,
  amount range, quantity).
- Prices come from `products` / `product_variants`, never from the AI.
- `create_gift_card_order` uses an idempotency key hashed with the buyer id as
  `orders.payment_reference`; a retry returns the existing order instead of
  creating a second one.
- Rate limits are shared through `mcp_rate_limits`: 240 requests/minute per IP,
  120/minute per read tool, 10/minute for order creation.
- Order tools return only rows whose `buyer_id` matches the verified JWT.
- This phase never marks an order paid or issues a gift card.
