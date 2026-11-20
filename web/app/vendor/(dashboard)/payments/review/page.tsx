import { requireVendor } from '@/lib/auth';
import { loadMerchantBundleCached } from '@/lib/merchant-server';
import { ReviewPanel } from '@/components/payments/ReviewPanel';
import { PageHead } from '@/components/ui';

export default async function VendorPaymentReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireVendor();
  const bundle = await loadMerchantBundleCached(ctx.supabase, 'vendor', ctx.vendor.id);

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Online payments"
        title="Review and submit"
        description="Check every section before submitting. You can edit anything until you submit."
      />
      <ReviewPanel bundle={bundle} basePath="/vendor/payments" error={params.error} />
    </div>
  );
}
