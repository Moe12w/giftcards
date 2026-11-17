import { requireVendor } from '@/lib/auth';
import { loadMerchantBundle } from '@/lib/merchant-server';
import { MerchantPaymentsOverview } from '@/components/MerchantPaymentsOverview';
import { Notice, PageHead } from '@/components/ui';

export default async function VendorPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireVendor();
  const bundle = await loadMerchantBundle(ctx.supabase, 'vendor', ctx.vendor.id);

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Online payments"
        title="Accept card payments"
        description="Apply for a MyFatoorah merchant account, upload your documents and sign the processing agreement. Your dashboard stays available throughout."
      />
      <Notice
        error={params.error}
        success={
          params.submitted === '1'
            ? 'Application submitted. We will review it and keep you updated.'
            : null
        }
      />
      <MerchantPaymentsOverview bundle={bundle} basePath="/vendor/payments" />
    </div>
  );
}
