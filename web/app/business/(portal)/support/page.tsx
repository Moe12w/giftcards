import { requireApprovedBusinessBuyer } from '@/lib/auth';
import { PageHead } from '@/components/ui';
import { SupportTickets, type SupportTicketRow } from '@/components/SupportTickets';
import { supportCopy } from '@/lib/i18n/support';
import { pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

export default async function BusinessSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireApprovedBusinessBuyer();
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(supportCopy, locale);

  const { data } = await ctx.supabase
    .from('support_requests')
    .select(
      'id, kind, requester_kind, organization_name, subject, body, reference, status, created_at, messages:support_ticket_messages(id, author_role, author_name, body, created_at)',
    )
    .eq('customer_id', ctx.user.id)
    .order('created_at', { ascending: false })
    .order('created_at', { referencedTable: 'support_ticket_messages', ascending: true })
    .limit(100);

  const tickets = (data ?? []) as SupportTicketRow[];

  return (
    <div className="dash-content">
      <PageHead eyebrow={t.eyebrow} title={t.title} description={t.description} />

      <SupportTickets
        audience="business"
        returnTo="/business/support"
        tickets={tickets}
        copy={t}
        locale={locale}
        sent={params.sent === '1'}
        error={params.error ?? null}
      />
    </div>
  );
}
