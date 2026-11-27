import {
  IntegrationError,
  optionalPositiveInteger,
  optionalString,
  requireString,
  resolveMapping,
  rpcRow,
  runIntegration,
} from '@/lib/integrations/gateway';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface CaptureRow {
  reservation_id: string;
  reservation_reference: string;
  status: string;
  redemption_id: string | null;
  redemption_reference: string | null;
  amount_minor: number;
  currency: string;
  masked_code: string | null;
  vendor_name: string | null;
  new_balance_minor: number | null;
  captured_at: string | null;
}

/**
 * Finalises a reservation. The RPC may return `reconciliation` instead of
 * capturing when the card was spent elsewhere; that state is already committed,
 * so it is reported as a 409 rather than retried as a server error.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;

  return runIntegration(request, {
    operation: 'capture',
    idempotent: true,
    handler: async (context) => {
      const externalVendorId = requireString(context.body, 'external_vendor_id', {
        maxLength: 200,
      });
      const externalBranchId = optionalString(context.body, 'external_branch_id', {
        maxLength: 200,
      });
      const currency = requireString(context.body, 'currency', { maxLength: 8 });
      const externalPaymentReference = optionalString(
        context.body,
        'external_payment_reference',
        { maxLength: 200 },
      );
      const confirmedOrderAmountMinor = optionalPositiveInteger(
        context.body,
        'confirmed_order_amount_minor',
      );

      const mapping = await resolveMapping(context, externalVendorId, externalBranchId);

      const { data, error } = await context.admin.rpc('integration_capture', {
        p_platform_id: context.platformId,
        p_reservation_reference: reference,
        p_external_payment_reference: externalPaymentReference,
        p_confirmed_order_amount_minor: confirmedOrderAmountMinor,
        p_currency: currency,
        p_idempotency_key: context.idempotencyKey,
        p_mapping_id: mapping.mapping_id,
      });
      if (error) throw error;

      const row = rpcRow<CaptureRow>(data);
      if (!row) throw new IntegrationError('RESERVATION_NOT_FOUND');

      if (row.status === 'reconciliation') {
        throw new IntegrationError('RECONCILIATION_REQUIRED');
      }
      if (row.status !== 'captured') {
        throw new IntegrationError('RESERVATION_NOT_CAPTURABLE');
      }

      return {
        resourceType: 'integration_reservation',
        resourceId: row.reservation_id,
        data: {
          operation: 'capture',
          status: row.status,
          reservation_reference: row.reservation_reference,
          redemption_id: row.redemption_id,
          redemption_reference: row.redemption_reference,
          amount_minor: row.amount_minor,
          currency: row.currency,
          card: {
            masked_code: row.masked_code,
            vendor_name: row.vendor_name,
          },
          new_balance_minor: row.new_balance_minor,
          captured_at: row.captured_at,
        },
      };
    },
  });
}
