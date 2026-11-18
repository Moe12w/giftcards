import { requireVendor } from '@/lib/auth';
import { FinancialsView } from '@/components/FinancialsView';
import { getLocale } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function VendorFinancialPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string }>;
}) {
  const ctx = await requireVendor();
  const locale = await getLocale();
  const search = await searchParams;

  return (
    <FinancialsView
      supabase={ctx.supabase}
      ownerType="vendor"
      ownerId={ctx.vendor.id}
      locale={locale}
      search={search}
    />
  );
}
