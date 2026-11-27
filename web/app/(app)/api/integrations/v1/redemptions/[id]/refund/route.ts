import {
  IntegrationError,
  optionalString,
  requirePositiveInteger,
  requireString,
  resolveMapping,
  rpcRow,
  runIntegration,
} from '@/lib/integrations/gateway';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface RefundRow {
  refund_id: string;
  redemption_id: string;
  amount_minor: number;
  new_balance_minor: number;
  new_status: string;
  fully_refunded: boolean;
  already_refunded_minor: number;
}

/**
 * Audited reversal of an external redemption. It writes a positive `refund`
 * ledger entry and never creates an order or a purchase refund.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return runIntegration(request, {
    operation: 'refund',
    idempotent: true,
    handler: async (context) => {
      const externalVendorId = optionalString(context.body, 'external_vendor_id', {
        maxLength: 200,
      });
      const externalBranchId = optionalString(context.body, 'external_branch_id', {
        maxLength: 200,
      });
      const amountMinor = requirePositiveInteger(context.body, 'amount_minor');
      const reason = optionalString(context.body, 'reason', { maxLength: 500 });

      const mapping = await resolveMapping(context, externalVendorId, externalBranchId);

      const { data, error } = await context.admin.rpc('integration_refund', {
        p_platform_id: context.platformId,
        p_redemption_id: id,
        p_amount_minor: amountMinor,
        p_reason: reason,
        p_idempotency_key: context.idempotencyKey,
        p_mapping_id: mapping.mapping_id,
      });
      if (error) throw error;

      const row = rpcRow<RefundRow>(data);
      if (!row) throw new IntegrationError('REDEMPTION_NOT_FOUND');

      return {
        resourceType: 'integration_refund',
        resourceId: row.refund_id,
        data: {
          operation: 'refund',
          status: 'completed',
          redemption_id: row.redemption_id,
          refund_id: row.refund_id,
          amount_minor: row.amount_minor,
          new_balance_minor: row.new_balance_minor,
          new_status: row.new_status,
          fully_refunded: row.fully_refunded,
          refunded_total_minor: row.already_refunded_minor,
        },
      };
    },
  });
}
