import type { SupabaseClient } from '@supabase/supabase-js';

import { PageHead } from '@/components/ui';
import { SupportTickets, type SupportTicketRow } from '@/components/SupportTickets';
import { supportCopy } from '@/lib/i18n/support';
import { pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

/** Shared support inbox for vendor and enterprise dashboards. */
export async function SupportPage({
  audience,
  returnTo,
  supabase,
  userId,
  preferredLanguage,
  sent,
  error,
}: {
  audience: 'vendor' | 'enterprise';
  returnTo: string;
  supabase: SupabaseClient;
  userId: string;
  preferredLanguage?: string | null;
  sent?: string;
  error?: string;
}) {
  const locale = await getUserLocale(preferredLanguage);
  const t = pick(supportCopy, locale);

  const { data } = await supabase
    .from('support_requests')
    .select(
      'id, kind, requester_kind, organization_name, subject, body, reference, status, created_at, messages:support_ticket_messages(id, author_role, author_name, body, created_at)',
    )
    .eq('customer_id', userId)
    .order('created_at', { ascending: false })
    .order('created_at', { referencedTable: 'support_ticket_messages', ascending: true })
    .limit(100);

  const tickets = (data ?? []) as SupportTicketRow[];

  return (
    <div className="dash-content">
      <PageHead eyebrow={t.eyebrow} title={t.title} description={t.description} />

      <SupportTickets
        audience={audience}
        returnTo={returnTo}
        tickets={tickets}
        copy={t}
        locale={locale}
        sent={sent === '1'}
        error={error ?? null}
      />
    </div>
  );
}
