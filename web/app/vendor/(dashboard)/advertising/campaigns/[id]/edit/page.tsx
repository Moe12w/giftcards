import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireAdvertiser } from '@/lib/auth';
import { PageHead } from '@/components/ui';
import { CampaignWizard } from '@/components/CampaignWizard';
import { updateAdvertisingCampaign } from '@/lib/actions/advertising';
import { getUserLocale } from '@/lib/i18n/server';

export default async function EditAdvertisingCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireAdvertiser();
  const locale = await getUserLocale(ctx.profile?.preferred_language);

  const { data: campaign } = await ctx.supabase
    .from('advertising_campaigns')
    .select('*, advertising_creatives(*)')
    .eq('id', id)
    .eq('vendor_id', ctx.vendor.id)
    .maybeSingle();

  if (!campaign) notFound();

  const [placementsResult, offersResult, categoriesResult] = await Promise.all([
    ctx.supabase
      .from('advertising_placements')
      .select('*, advertising_pricing(*)')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    ctx.supabase
      .from('offers')
      .select('id, title')
      .eq('vendor_id', ctx.vendor.id)
      .eq('status', 'published')
      .order('title', { ascending: true })
      .limit(200),
    ctx.supabase
      .from('categories')
      .select('id, name')
      .eq('active', true)
      .order('sort_order', { ascending: true }),
  ]);

  const placements = (placementsResult.data ?? []).map((placement: any) => ({
    ...placement,
    advertising_pricing: (placement.advertising_pricing ?? []).filter((price: any) => price.is_active),
  }));

  return (
    <div className="dash-content">
      <Link className="back-link" href={`${ctx.home}/campaigns/${campaign.id}`}>
        <ArrowLeft size={15} /> Back to campaign
      </Link>
      <PageHead
        eyebrow="Advertising & promotions"
        title="Edit campaign"
        description="Editing creative or schedule after payment sends the campaign back for approval. Budgets are locked once paid."
      />
      <CampaignWizard
        action={updateAdvertisingCampaign}
        placements={placements}
        offers={(offersResult.data ?? []) as { id: string; title: string }[]}
        categories={(categoriesResult.data ?? []) as { id: string; name: string }[]}
        vendorId={ctx.vendor.id}
        vendorName={ctx.vendor.name}
        home={ctx.home}
        locale={locale}
        campaign={campaign as any}
      />
    </div>
  );
}
