import { requireEnterprise } from '@/lib/auth';
import { loadMerchantBundle } from '@/lib/merchant-server';
import { AgreementPanel } from '@/components/payments/AgreementPanel';
import { PageHead } from '@/components/ui';

export default async function EnterprisePaymentAgreementPage({
  searchParams,
}: {
  searchParams: Promise<{ signed?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireEnterprise();
  const bundle = await loadMerchantBundle(ctx.supabase, 'partner', ctx.partner.id);

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Online payments"
        title="Payment processing agreement"
        description="Read the agreement, then sign it electronically on behalf of the organisation. Your signed copy is stored securely with the version you signed."
      />
      <AgreementPanel
        bundle={bundle}
        basePath="/enterprise/payments"
        error={params.error}
        success={params.signed === '1' ? 'Agreement signed and stored securely.' : null}
      />
    </div>
  );
}
