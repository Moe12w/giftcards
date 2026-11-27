import {
  IntegrationError,
  optionalPositiveInteger,
  optionalString,
  requireString,
  rpcRow,
  runIntegration,
} from '@/lib/integrations/gateway';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface OrderEventRow {
  duplicate: boolean;
  event_type: string;
  external_order_id: string;
  order_status: string | null;
  reservation_status: string | null;
}

/**
 * Verified platform lifecycle event. Events are deduplicated by
 * `(provider, event_id)` in the existing webhook_events table. An order event
 * never captures money; capture stays an explicit, signed operation.
 */
export async function POST(request: Request) {
  return runIntegration(request, {
    operation: 'order_event',
    idempotent: true,
    handler: async (context) => {
      const eventId = requireString(context.body, 'event_id', { maxLength: 200 });
      const eventType = requireString(context.body, 'event_type', { maxLength: 100 });
      const externalOrderId = requireString(context.body, 'external_order_id', {
        maxLength: 200,
      });
      const reservationReference = optionalString(
        context.body,
        'reservation_reference',
        { maxLength: 200 },
      );
      const currency = requireString(context.body, 'currency', { maxLength: 8 });
      const amountMinor = optionalPositiveInteger(context.body, 'amount_minor');
      const occurredAt = optionalString(context.body, 'occurred_at', { maxLength: 64 });

      const { data, error } = await context.admin.rpc('integration_process_order_event', {
        p_platform_id: context.platformId,
        p_event_id: eventId,
        p_event_type: eventType,
        p_external_order_id: externalOrderId,
        p_reservation_reference: reservationReference,
        p_amount_minor: amountMinor,
        p_currency: currency,
        p_occurred_at: occurredAt,
        p_payload: context.body,
      });
      if (error) throw error;

      const row = rpcRow<OrderEventRow>(data);
      if (!row) throw new IntegrationError('INTERNAL_ERROR');

      return {
        data: {
          operation: 'order_event',
          duplicate: row.duplicate,
          event_type: row.event_type,
          external_order_id: row.external_order_id,
          order_status: row.order_status,
          reservation_status: row.reservation_status,
        },
      };
    },
  });
}
