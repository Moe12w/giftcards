import { requireVendor } from '@/lib/auth';
import { loadMerchantBundleCached } from '@/lib/merchant-server';
import { AgreementPanel } from '@/components/payments/AgreementPanel';
import { PageHead } from '@/components/ui';

export default async function VendorPaymentAgreementPage({
  searchParams,
}: {
  searchParams: Promise<{ signed?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireVendor();
  const bundle = await loadMerchantBundleCached(ctx.supabase, 'vendor', ctx.vendor.id);

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Online payments"
        title="Payment processing agreement"
        description="Read the agreement, then sign it electronically. Your signed copy is stored securely with the version you signed."
      />
      <AgreementPanel
        bundle={bundle}
        basePath="/vendor/payments"
        error={params.error}
        success={params.signed === '1' ? 'Agreement signed and stored securely.' : null}
      />
    </div>
  );
}
