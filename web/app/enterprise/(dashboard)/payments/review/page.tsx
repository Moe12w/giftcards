import { requireEnterprise } from '@/lib/auth';
import { loadMerchantBundleCached } from '@/lib/merchant-server';
import { ReviewPanel } from '@/components/payments/ReviewPanel';
import { PageHead } from '@/components/ui';

export default async function EnterprisePaymentReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireEnterprise();
  const bundle = await loadMerchantBundleCached(ctx.supabase, 'partner', ctx.partner.id);

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Online payments"
        title="Review and submit"
        description="Check every section before submitting. You can edit anything until you submit."
      />
      <ReviewPanel bundle={bundle} basePath="/enterprise/payments" error={params.error} />
    </div>
  );
}
