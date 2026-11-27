import {
  cardReasonError,
  IntegrationError,
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

interface PreviewRow {
  found: boolean;
  valid: boolean;
  reason: string | null;
  masked_code: string | null;
  vendor_name: string | null;
  currency: string | null;
  balance_minor: number | null;
  reserved_minor: number | null;
  available_minor: number | null;
  order_amount_minor: number;
  applied_amount_minor: number;
  remaining_order_amount_minor: number;
  expires_at: string | null;
}

/**
 * Read-only eligible-amount preview. Creates no hold and writes no ledger row.
 */
export async function POST(request: Request) {
  return runIntegration(request, {
    operation: 'preview',
    idempotent: false,
    handler: async (context) => {
      const externalVendorId = optionalString(context.body, 'external_vendor_id', {
        maxLength: 200,
      });
      const externalBranchId = optionalString(context.body, 'external_branch_id', {
        maxLength: 200,
      });
      const cardCode = requireString(context.body, 'card_code', { maxLength: 200 });
      const currency = requireString(context.body, 'currency', { maxLength: 8 });
      const orderAmountMinor = requirePositiveInteger(context.body, 'order_amount_minor');
      const requestedAmountMinor = optionalPositiveInteger(
        context.body,
        'requested_amount_minor',
      );

      const mapping = await resolveMapping(context, externalVendorId, externalBranchId);

      const { data, error } = await context.admin.rpc('integration_preview', {
        p_platform_id: context.platformId,
        p_mapping_id: mapping.mapping_id,
        p_card_code: cardCode,
        p_order_amount_minor: orderAmountMinor,
        p_requested_amount_minor: requestedAmountMinor,
        p_currency: currency,
      });
      if (error) throw error;

      const row = rpcRow<PreviewRow>(data);
      if (!row || !row.found) throw new IntegrationError('CARD_NOT_FOUND');
      if (!row.valid) throw cardReasonError(row.reason);

      return {
        data: {
          operation: 'preview',
          status: 'preview',
          card: {
            masked_code: row.masked_code,
            vendor_name: row.vendor_name,
          },
          currency: row.currency,
          balance_minor: row.balance_minor,
          reserved_minor: row.reserved_minor,
          available_minor: row.available_minor,
          order_amount_minor: row.order_amount_minor,
          applied_amount_minor: row.applied_amount_minor,
          remaining_order_amount_minor: row.remaining_order_amount_minor,
          expires_at: row.expires_at,
        },
      };
    },
  });
}
