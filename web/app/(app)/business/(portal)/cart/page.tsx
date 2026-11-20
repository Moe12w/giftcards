import { requireApprovedBusinessBuyer } from '@/lib/auth';
import { Notice, PageHead } from '@/components/ui';
import { BulkCart, type BulkCartOffer } from '@/components/BulkCart';

export const dynamic = 'force-dynamic';

export default async function BusinessCartPage() {
  await requireApprovedBusinessBuyer();

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();
  const { data: offers } = await admin
    .from('bulk_offers')
    .select(
      'id, title, face_value_minor, base_unit_price_minor, min_quantity, max_quantity, available_quantity, vendor_id, partner_id, status, enabled, tiers:bulk_offer_price_tiers(min_quantity, max_quantity, unit_price_minor, sort_order), vendor:vendors(name, status, myfatoorah_supplier_code, myfatoorah_supplier_status, payment_eligibility), partner:enterprise_partners(name, status, myfatoorah_supplier_code, myfatoorah_supplier_status, payment_eligibility)',
    )
    .eq('status', 'active')
    .eq('enabled', true)
    .order('title')
    .limit(200);

  const cartOffers: BulkCartOffer[] = (offers ?? [])
    .filter((offer: any) => offer.vendor_id || offer.partner_id)
    .map((offer: any) => {
      const vendor = Array.isArray(offer.vendor) ? offer.vendor[0] : offer.vendor;
      const partner = Array.isArray(offer.partner) ? offer.partner[0] : offer.partner;
      const supplier = vendor ?? partner;
      return {
        id: offer.id,
        title: offer.title,
        vendorName: supplier?.name ?? 'Business',
        faceValueMinor: Number(offer.face_value_minor ?? 0),
        baseUnitPriceMinor: Number(offer.base_unit_price_minor ?? 0),
        minQuantity: Number(offer.min_quantity ?? 1),
        maxQuantity: offer.max_quantity == null ? null : Number(offer.max_quantity),
        availableQuantity: offer.available_quantity == null ? null : Number(offer.available_quantity),
        supplierReady:
          (vendor ? vendor.status === 'approved' : partner?.status === 'active') &&
          Boolean(supplier?.myfatoorah_supplier_code) &&
          String(supplier?.myfatoorah_supplier_status).toLowerCase() === 'active' &&
          Boolean(supplier?.payment_eligibility),
        tiers: (offer.tiers ?? []).map((tier: any) => ({
          min_quantity: Number(tier.min_quantity),
          max_quantity: tier.max_quantity == null ? null : Number(tier.max_quantity),
          unit_price_minor: Number(tier.unit_price_minor),
          sort_order: Number(tier.sort_order ?? 0),
        })),
      };
    });

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Business / Bulk Buyer"
        title="Basket & checkout"
        description="Choose gifts from several vendors and pay for them all in one secure MyFatoorah checkout."
      />
      <Notice />
      <BulkCart offers={cartOffers} />
    </div>
  );
}
