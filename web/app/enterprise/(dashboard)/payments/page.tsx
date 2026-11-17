import { requireEnterprise } from '@/lib/auth';
import { loadMerchantBundle } from '@/lib/merchant-server';
import { MerchantPaymentsOverview } from '@/components/MerchantPaymentsOverview';
import { Notice, PageHead } from '@/components/ui';

export default async function EnterprisePaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireEnterprise();
  const bundle = await loadMerchantBundle(ctx.supabase, 'partner', ctx.partner.id);

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Online payments"
        title="Organisation payment processing"
        description="One payment application covers the whole organisation. The primary administrator submits the documentation once; branches do not repeat it."
      />
      <Notice
        error={params.error}
        success={
          params.submitted === '1'
            ? 'Application submitted. We will review it and keep you updated.'
            : null
        }
      />
      <MerchantPaymentsOverview bundle={bundle} basePath="/enterprise/payments" />
    </div>
  );
}
