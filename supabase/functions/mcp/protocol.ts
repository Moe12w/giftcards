// supabase/functions/mcp/protocol.ts
// Small, dependency-free JSON-RPC and MCP protocol helpers.
//
// The MCP Streamable HTTP transport is JSON-RPC 2.0 over POST. This endpoint is
// stateless: it does not create sessions and always answers with a single JSON
// document, which the transport allows.

export const SUPPORTED_PROTOCOL_VERSIONS = [
  '2025-06-18',
  '2025-03-26',
  '2024-11-05',
] as const;

export type ProtocolVersion = (typeof SUPPORTED_PROTOCOL_VERSIONS)[number];

export const LATEST_PROTOCOL_VERSION: ProtocolVersion = '2025-06-18';

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

export function isProtocolVersion(value: string): value is ProtocolVersion {
  return (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(value);
}

export function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.jsonrpc === '2.0' && typeof record.method === 'string';
}

export function rpcResult(id: JsonRpcId, value: unknown) {
  return { jsonrpc: '2.0' as const, id, result: value };
}

export function rpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
) {
  return {
    jsonrpc: '2.0' as const,
    id,
    error: {
      code,
      message,
      ...(data === undefined ? {} : { data }),
    },
  };
}

/** A safe, expected failure that should be shown to the AI as a tool error. */
export class ToolError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ToolError';
    this.code = code;
  }
}
