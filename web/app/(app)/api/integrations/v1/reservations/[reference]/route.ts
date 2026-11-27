import { IntegrationError, rpcRow, runIntegration } from '@/lib/integrations/gateway';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface StatusRow {
  reservation_id: string;
  reservation_reference: string;
  status: string;
  external_order_id: string;
  amount_minor: number;
  currency: string;
  expires_at: string;
  captured_at: string | null;
  released_at: string | null;
  redemption_id: string | null;
  redemption_reference: string | null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;

  return runIntegration(request, {
    operation: 'status',
    idempotent: false,
    parseBody: false,
    requireSignature: false,
    handler: async (context) => {
      const { data, error } = await context.admin.rpc('integration_status', {
        p_platform_id: context.platformId,
        p_reservation_reference: reference,
      });
      if (error) throw error;

      const row = rpcRow<StatusRow>(data);
      if (!row) throw new IntegrationError('RESERVATION_NOT_FOUND');

      return {
        data: {
          operation: 'status',
          status: row.status,
          reservation_reference: row.reservation_reference,
          external_order_id: row.external_order_id,
          amount_minor: row.amount_minor,
          currency: row.currency,
          expires_at: row.expires_at,
          captured_at: row.captured_at,
          released_at: row.released_at,
          redemption_reference: row.redemption_reference,
        },
      };
    },
  });
}
