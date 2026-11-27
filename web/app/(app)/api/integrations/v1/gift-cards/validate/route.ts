import {
  optionalString,
  rateLimitCard,
  requireString,
  resolveMapping,
  rpcRow,
  runIntegration,
} from '@/lib/integrations/gateway';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface CardStateRow {
  found: boolean;
  valid: boolean;
  reason: string | null;
  masked_code: string | null;
  vendor_name: string | null;
  currency: string | null;
  balance_minor: number | null;
  reserved_minor: number | null;
  available_minor: number | null;
  expires_at: string | null;
  monetary: boolean | null;
  partial_allowed: boolean | null;
}

const REASON_MAP: Record<string, string> = {
  not_found: 'not_found',
  wrong_business: 'not_found',
  not_monetary: 'not_monetary',
  inactive: 'inactive',
  expired: 'expired',
  currency_mismatch: 'currency_mismatch',
  no_balance: 'no_balance',
};

/**
 * Read-only card lookup for the mapped business. Never returns a full card
 * code, a voucher id, a buyer id or another business's name.
 */
export async function POST(request: Request) {
  return runIntegration(request, {
    operation: 'validate',
    idempotent: false,
    handler: async (context) => {
      const externalVendorId = optionalString(context.body, 'external_vendor_id', {
        maxLength: 200,
      });
      const externalBranchId = optionalString(context.body, 'external_branch_id', {
        maxLength: 200,
      });
      const cardCode = requireString(context.body, 'card_code', { maxLength: 200 });
      const currency = optionalString(context.body, 'currency', { maxLength: 8 });

      await rateLimitCard(context, cardCode);

      const mapping = await resolveMapping(context, externalVendorId, externalBranchId);

      const { data, error } = await context.admin.rpc('integration_card_state', {
        p_platform_id: context.platformId,
        p_mapping_id: mapping.mapping_id,
        p_card_code: cardCode,
        p_currency: currency,
      });
      if (error) throw error;

      const state = rpcRow<CardStateRow>(data);
      if (!state || !state.found) {
        return { data: { valid: false, reason: 'not_found' } };
      }

      const reason = state.reason ? (REASON_MAP[state.reason] ?? 'inactive') : null;

      // A card belonging to another business is indistinguishable from a card
      // that does not exist.
      if (reason === 'not_found') {
        return { data: { valid: false, reason } };
      }

      return {
        data: {
          valid: state.valid,
          reason,
          card: {
            masked_code: state.masked_code,
            vendor_name: state.vendor_name,
          },
          currency: state.currency,
          balance_minor: state.balance_minor,
          reserved_minor: state.reserved_minor,
          available_minor: state.available_minor,
          expires_at: state.expires_at,
          restrictions: {
            monetary_only: state.monetary ?? true,
            partial_allowed: state.partial_allowed ?? true,
          },
        },
      };
    },
  });
}
