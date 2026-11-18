import { requireEnterprise } from '@/lib/auth';
import { FinancialsView } from '@/components/FinancialsView';
import { getLocale } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function EnterpriseFinancialPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string }>;
}) {
  const ctx = await requireEnterprise();
  const locale = await getLocale();
  const search = await searchParams;

  return (
    <FinancialsView
      supabase={ctx.supabase}
      ownerType="partner"
      ownerId={ctx.partner.id}
      locale={locale}
      search={search}
    />
  );
}
