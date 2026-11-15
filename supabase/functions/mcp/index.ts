// supabase/functions/mcp/index.ts
// Giftly MCP server — Streamable HTTP transport, stateless JSON responses.
//
// Deploy with JWT verification off so AI clients can reach the public read
// tools:
//   supabase functions deploy mcp --no-verify-jwt
//
// The function still verifies the customer's Supabase access token itself for
// create_gift_card_order and check_order_status. Service-role credentials never
// leave the Edge Function.

import { adminClient } from '../_shared/clients.ts';
import {
  LATEST_PROTOCOL_VERSION,
  ToolError,
  isJsonRpcRequest,
  isProtocolVersion,
  rpcError,
  rpcResult,
  type JsonRpcId,
} from './protocol.ts';
import {
  PROTECTED_TOOLS,
  TOOLS,
  WRITE_TOOLS,
  callTool,
} from './tools.ts';
import { ValidationError } from './validate.ts';

const SERVER_INFO = {
  name: 'giftly-ai-gift-cards',
  title: 'Giftly AI Gift Cards',
  version: '1.0.0',
};

const INSTRUCTIONS = `Giftly is a gift card marketplace in Qatar. Use these tools to help a customer discover local businesses and their gift cards, compare amounts or experience packages, and prepare a pending order.

Rules:
- Always start with search_businesses, then get_business_details or get_gift_cards, then get_gift_card_details before ordering.
- Never invent a business, gift card, variant, amount or price. Use the IDs and prices returned by the tools.
- Prices are in QAR and are stored in fils: 1 QAR = 100 fils.
- Monetary gift cards are ordered with amount_minor. Experience gift cards are ordered with variant_id.
- create_gift_card_order only prepares a pending order. It does not take payment, create a payment link, or issue a gift card. Never tell the customer that a purchase is complete.
- create_gift_card_order and check_order_status need the customer's Giftly access token as an Authorization: Bearer header.
- Confirm the business, gift card, amount or package, quantity and recipient with the customer before preparing an order.`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info, mcp-session-id, mcp-protocol-version, last-event-id',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id, Mcp-Protocol-Version',
};

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

const memoryBuckets = new Map<string, { started: number; hits: number }>();

function memoryRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);
  if (!bucket || now - bucket.started >= windowMs) {
    memoryBuckets.set(key, { started: now, hits: 1 });
    if (memoryBuckets.size > 5000) {
      for (const [name, value] of memoryBuckets) {
        if (now - value.started >= windowMs) memoryBuckets.delete(name);
      }
    }
    return limit >= 1;
  }
  bucket.hits += 1;
  return bucket.hits <= limit;
}

/**
 * Uses the shared Postgres counter when migration 0107 is applied, and falls
 * back to this isolate's memory if the RPC is unavailable. The fallback keeps
 * the endpoint usable during a rolling deploy; the database counter is the
 * real protection across isolates.
 */
async function takeRateLimit(
  admin: ReturnType<typeof adminClient>,
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc('mcp_take_rate_limit', {
      p_bucket: key,
      p_limit: limit,
      p_window_seconds: Math.ceil(windowMs / 1000),
    });
    if (!error && typeof data === 'boolean') return data;
  } catch {
    // Fall through to the in-memory bucket.
  }
  return memoryRateLimit(key, limit, windowMs);
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    forwarded?.split(',')[0]?.trim() ??
    'unknown'
  );
}

async function userIdFromRequest(
  admin: ReturnType<typeof adminClient>,
  req: Request,
): Promise<string | null> {
  const header = req.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const { data, error } = await admin.auth.getUser(match[1]);
  if (error || !data.user) return null;
  return data.user.id;
}

function toolErrorResult(code: string, message: string) {
  const payload = { error: { code, message } };
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
    isError: true,
  };
}

function toolSuccessResult(output: unknown) {
  return {
    content: [
      { type: 'text' as const, text: JSON.stringify(output, null, 2) },
    ],
    structuredContent: output,
    isError: false,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Streamable HTTP allows a server to decline the optional GET stream.
  if (req.method === 'GET') {
    return new Response(
      'This MCP endpoint uses Streamable HTTP POST requests. It does not offer a server-sent event stream.',
      {
        status: 405,
        headers: { ...corsHeaders, Allow: 'POST, DELETE' },
      },
    );
  }

  if (req.method === 'DELETE') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      rpcError(null, -32600, 'Only POST requests are supported.'),
      405,
      { Allow: 'POST, DELETE' },
    );
  }

  const protocolHeader = req.headers.get('mcp-protocol-version');
  if (protocolHeader && !isProtocolVersion(protocolHeader)) {
    return jsonResponse(
      rpcError(
        null,
        -32600,
        `Unsupported MCP protocol version: ${protocolHeader}. Supported versions: 2025-06-18, 2025-03-26, 2024-11-05.`,
      ),
      400,
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(rpcError(null, -32700, 'Parse error.'), 400);
  }

  if (Array.isArray(body)) {
    return jsonResponse(
      rpcError(null, -32600, 'Batch requests are not supported.'),
      400,
    );
  }
  if (!isJsonRpcRequest(body)) {
    return jsonResponse(rpcError(null, -32600, 'Invalid JSON-RPC request.'), 400);
  }

  // Notifications do not receive a response.
  if (body.id === undefined) {
    return new Response(null, { status: 202, headers: corsHeaders });
  }

  const id: JsonRpcId = body.id;
  const admin = adminClient();
  const ip = clientIp(req);

  const withinGeneralLimit = await takeRateLimit(
    admin,
    `mcp:${ip}`,
    240,
    60_000,
  );
  if (!withinGeneralLimit) {
    return jsonResponse(
      rpcError(id, -32000, 'Rate limit exceeded. Try again shortly.'),
      429,
      { 'Retry-After': '60' },
    );
  }

  try {
    switch (body.method) {
      case 'initialize': {
        const params =
          body.params && typeof body.params === 'object'
            ? (body.params as Record<string, unknown>)
            : {};
        const requested =
          typeof params.protocolVersion === 'string'
            ? params.protocolVersion
            : LATEST_PROTOCOL_VERSION;
        const protocolVersion = isProtocolVersion(requested)
          ? requested
          : LATEST_PROTOCOL_VERSION;

        return jsonResponse(
          rpcResult(id, {
            protocolVersion,
            capabilities: {
              tools: { listChanged: false },
            },
            serverInfo: SERVER_INFO,
            instructions: INSTRUCTIONS,
          }),
          200,
          { 'Mcp-Protocol-Version': protocolVersion },
        );
      }

      case 'ping':
        return jsonResponse(rpcResult(id, {}));

      case 'tools/list':
        return jsonResponse(rpcResult(id, { tools: TOOLS }));

      case 'tools/call': {
        const params =
          body.params && typeof body.params === 'object' && !Array.isArray(body.params)
            ? (body.params as Record<string, unknown>)
            : null;
        if (!params) {
          return jsonResponse(rpcError(id, -32602, 'Invalid params.'), 200);
        }
        const name = typeof params.name === 'string' ? params.name : '';
        if (!name) {
          return jsonResponse(
            rpcError(id, -32602, 'Tool name is required.'),
            200,
          );
        }
        const tool = TOOLS.find((item) => item.name === name);
        if (!tool) {
          return jsonResponse(
            rpcError(id, -32602, `Unknown tool: ${name}`),
            200,
          );
        }

        const withinToolLimit = await takeRateLimit(
          admin,
          `mcp:${ip}:${name}`,
          WRITE_TOOLS.has(name) ? 10 : 120,
          60_000,
        );
        if (!withinToolLimit) {
          return jsonResponse(
            rpcError(id, -32000, 'Rate limit exceeded for this tool. Try again shortly.'),
            429,
            { 'Retry-After': '60' },
          );
        }

        let userId: string | null = null;
        if (PROTECTED_TOOLS.has(name)) {
          userId = await userIdFromRequest(admin, req);
          if (!userId) {
            return jsonResponse(
              rpcResult(
                id,
                toolErrorResult(
                  'auth_required',
                  'Sign in to Giftly first. This tool needs the customer\'s Giftly access token as a Bearer token. No order data is available without it.',
                ),
              ),
              200,
            );
          }
        }

        try {
          const output = await callTool(name, params.arguments, {
            admin,
            userId,
          });
          return jsonResponse(rpcResult(id, toolSuccessResult(output)));
        } catch (error) {
          if (error instanceof ToolError) {
            return jsonResponse(
              rpcResult(id, toolErrorResult(error.code, error.message)),
              200,
            );
          }
          if (error instanceof ValidationError) {
            return jsonResponse(
              rpcResult(
                id,
                toolErrorResult('invalid_arguments', error.message),
              ),
              200,
            );
          }
          console.error('mcp tool failed', name, error);
          return jsonResponse(
            rpcResult(
              id,
              toolErrorResult(
                'internal_error',
                'The tool could not complete. Nothing was charged. Try again shortly.',
              ),
            ),
            200,
          );
        }
      }

      default:
        return jsonResponse(
          rpcError(id, -32601, `Method not found: ${body.method}`),
          200,
        );
    }
  } catch (error) {
    console.error('mcp request failed', error);
    return jsonResponse(
      rpcError(id, -32603, 'Internal server error.'),
      500,
    );
  }
});
