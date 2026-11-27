import {
  optionalPositiveInteger,
  optionalString,
  requirePositiveInteger,
  requireString,
  resolveMapping,
  rpcRow,
  runIntegration,
} from '@/lib/integrations/gateway';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ReserveRow {
  reservation_id: string;
  reservation_reference: string;
  status: string;
  voucher_id: string;
  masked_code: string | null;
  vendor_name: string | null;
  currency: string;
  amount_minor: number;
  balance_minor: number;
  reserved_minor: number;
  available_minor: number;
  order_amount_minor: number;
  remaining_order_amount_minor: number;
  expires_at: string;
}

/**
 * Creates a temporary hold. No ledger entry exists until capture.
 */
export async function POST(request: Request) {
  return runIntegration(request, {
    operation: 'reserve',
    idempotent: true,
    handler: async (context) => {
      const externalVendorId = requireString(context.body, 'external_vendor_id', {
        maxLength: 200,
      });
      const externalBranchId = optionalString(context.body, 'external_branch_id', {
        maxLength: 200,
      });
      const externalOrderId = requireString(context.body, 'external_order_id', {
        maxLength: 200,
      });
      const cardCode = requireString(context.body, 'card_code', { maxLength: 200 });
      const currency = requireString(context.body, 'currency', { maxLength: 8 });
      const orderAmountMinor = requirePositiveInteger(context.body, 'order_amount_minor');
      const requestedAmountMinor = optionalPositiveInteger(
        context.body,
        'requested_amount_minor',
      );
      const ttlSeconds = optionalPositiveInteger(context.body, 'ttl_seconds');

      const mapping = await resolveMapping(context, externalVendorId, externalBranchId);

      const { data, error } = await context.admin.rpc('integration_reserve', {
        p_platform_id: context.platformId,
        p_mapping_id: mapping.mapping_id,
        p_card_code: cardCode,
        p_external_order_id: externalOrderId,
        p_external_branch_id: externalBranchId,
        p_order_amount_minor: orderAmountMinor,
        p_requested_amount_minor: requestedAmountMinor,
        p_currency: currency,
        p_ttl_seconds: ttlSeconds,
        p_idempotency_key: context.idempotencyKey,
      });
      if (error) throw error;

      const row = rpcRow<ReserveRow>(data);
      if (!row) throw new Error('reserve returned no row');

      return {
        status: 201,
        resourceType: 'integration_reservation',
        resourceId: row.reservation_id,
        data: {
          operation: 'reserve',
          status: row.status,
          reservation_reference: row.reservation_reference,
          currency: row.currency,
          card: {
            masked_code: row.masked_code,
            vendor_name: row.vendor_name,
          },
          balance_minor: row.balance_minor,
          reserved_minor: row.reserved_minor,
          available_minor: row.available_minor,
          order_amount_minor: row.order_amount_minor,
          applied_amount_minor: row.amount_minor,
          remaining_order_amount_minor: row.remaining_order_amount_minor,
          expires_at: row.expires_at,
        },
      };
    },
  });
}
