import { requireEnterprise } from '@/lib/auth';
import { loadMerchantBundleCached } from '@/lib/merchant-server';
import { ApplicationWizard } from '@/components/payments/ApplicationWizard';
import { PageHead } from '@/components/ui';

export default async function EnterprisePaymentApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireEnterprise();
  const bundle = await loadMerchantBundleCached(ctx.supabase, 'partner', ctx.partner.id);
  const parsed = Number.parseInt(params.step ?? '1', 10);
  const step = Number.isFinite(parsed) ? parsed : 1;

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Online payments"
        title="Organisation payment application"
        description="Five steps. Everything saves as you go, so you can stop at any point and continue later."
      />
      <ApplicationWizard
        bundle={bundle}
        basePath="/enterprise/payments"
        step={step}
        error={params.error}
        success={params.saved === '1' ? 'Saved. You can leave and continue later.' : null}
        tone="lavender"
      />
    </div>
  );
}
