import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireAdvertiser } from '@/lib/auth';
import { PageHead } from '@/components/ui';
import { CampaignWizard } from '@/components/CampaignWizard';
import { createAdvertisingCampaign } from '@/lib/actions/advertising';
import { getUserLocale } from '@/lib/i18n/server';

export default async function NewAdvertisingCampaignPage() {
  const ctx = await requireAdvertiser();
  const vendor = ctx.vendor;
  const locale = await getUserLocale(ctx.profile?.preferred_language);

  const [placementsResult, offersResult, categoriesResult] = await Promise.all([
    ctx.supabase
      .from('advertising_placements')
      .select('*, advertising_pricing(*)')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    ctx.supabase
      .from('offers')
      .select('id, title')
      .eq('vendor_id', vendor.id)
      .eq('status', 'published')
      .order('title', { ascending: true })
      .limit(200),
    ctx.supabase
      .from('categories')
      .select('id, name')
      .eq('active', true)
      .order('sort_order', { ascending: true }),
  ]);

  const placements = (placementsResult.data ?? [])
    .map((placement: any) => ({
      ...placement,
      advertising_pricing: (placement.advertising_pricing ?? []).filter(
        (price: any) =>
          price.is_active &&
          (placement.allowed_pricing_models ?? ['fixed', 'cpc', 'cpm']).includes(price.pricing_model),
      ),
    }))
    .filter((placement: any) => placement.advertising_pricing.length > 0);

  return (
    <div className="dash-content">
      <Link className="back-link" href={ctx.home}>
        <ArrowLeft size={15} /> Advertising
      </Link>
      <PageHead
        eyebrow="Advertising & promotions"
        title="New campaign"
        description="Four steps: placement, creative, schedule and budget, then server-verified checkout."
      />
      <CampaignWizard
        action={createAdvertisingCampaign}
        placements={placements}
        offers={(offersResult.data ?? []) as { id: string; title: string }[]}
        categories={(categoriesResult.data ?? []) as { id: string; name: string }[]}
        vendorId={vendor.id}
        vendorName={vendor.name}
        home={ctx.home}
        locale={locale}
      />
    </div>
  );
}
