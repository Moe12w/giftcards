import {
  IntegrationError,
  optionalString,
  requireString,
  resolveMapping,
  rpcRow,
  runIntegration,
} from '@/lib/integrations/gateway';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ReleaseRow {
  reservation_id: string;
  reservation_reference: string;
  status: string;
  released_at: string | null;
  release_reason: string | null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;

  return runIntegration(request, {
    operation: 'release',
    idempotent: true,
    handler: async (context) => {
      const externalVendorId = optionalString(context.body, 'external_vendor_id', {
        maxLength: 200,
      });
      const externalBranchId = optionalString(context.body, 'external_branch_id', {
        maxLength: 200,
      });
      const reason = optionalString(context.body, 'reason', { maxLength: 500 });

      const mapping = await resolveMapping(context, externalVendorId, externalBranchId);

      const { data, error } = await context.admin.rpc('integration_release', {
        p_platform_id: context.platformId,
        p_reservation_reference: reference,
        p_reason: reason,
        p_idempotency_key: context.idempotencyKey,
        p_mapping_id: mapping.mapping_id,
      });
      if (error) throw error;

      const row = rpcRow<ReleaseRow>(data);
      if (!row) throw new IntegrationError('RESERVATION_NOT_FOUND');

      return {
        resourceType: 'integration_reservation',
        resourceId: row.reservation_id,
        data: {
          operation: 'release',
          status: row.status,
          reservation_reference: row.reservation_reference,
          released_at: row.released_at,
          release_reason: row.release_reason,
        },
      };
    },
  });
}
