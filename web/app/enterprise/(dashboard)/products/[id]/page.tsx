import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Boxes, Upload } from 'lucide-react';
import { requireEnterprise } from '@/lib/auth';
import { saveEnterpriseProduct } from '@/lib/actions/enterprise';
import { EnterpriseProductForm } from '@/components/EnterpriseProductForm';
import { Notice, PageHead, StatusTag } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import type { EnterpriseProduct } from '@/lib/types';

export default async function EditEnterpriseProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const ctx = await requireEnterprise();

  const { data } = await ctx.supabase
    .from('enterprise_products')
    .select('*')
    .eq('id', id)
    .eq('partner_id', ctx.partner.id)
    .maybeSingle();

  if (!data) notFound();
  const product = data as EnterpriseProduct;

  const { data: inventory } = await ctx.supabase
    .from('enterprise_inventory_summary')
    .select('status, denomination_minor')
    .eq('partner_id', ctx.partner.id)
    .eq('enterprise_product_id', product.id)
    .limit(5000);

  const rows = inventory ?? [];
  const available = rows.filter((item) => item.status === 'available').length;
  const allocated = rows.filter((item) => ['reserved', 'sold', 'delivered'].includes(item.status)).length;
  const redeemed = rows.filter((item) => item.status === 'redeemed').length;
  const availableValue = rows
    .filter((item) => item.status === 'available')
    .reduce((sum, item) => sum + Number(item.denomination_minor ?? 0), 0);

  return (
    <div className="dash-content">
      <Link className="back-link" href="/enterprise/products">
        <ArrowLeft size={15} /> Back to products
      </Link>
      <PageHead
        eyebrow="Reward product"
        title={product.name}
        description="Edit the commercial details. Existing codes keep the denomination they were imported with."
        actions={
          <>
            <StatusTag status={product.is_active ? 'active' : 'draft'} />
            <Link className="btn sm" href={`/enterprise/inventory?product=${product.id}`}>
              <Boxes size={14} /> Inventory
            </Link>
          </>
        }
      />

      <Notice error={query.error} success={query.saved === '1' ? 'Product saved.' : null} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--lavender-soft)' }}>
            <Boxes size={17} />
          </span>
          <strong>{available}</strong>
          <span>Available codes</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
            <Boxes size={17} />
          </span>
          <strong>{allocated}</strong>
          <span>Allocated codes</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <Boxes size={17} />
          </span>
          <strong>{redeemed}</strong>
          <span>Redeemed codes</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--coral-soft)' }}>
            <Upload size={17} />
          </span>
          <strong>{formatMoney(availableValue)}</strong>
          <span>Available face value</span>
        </div>
      </div>

      {ctx.role === 'analyst' ? (
        <div className="callout warn">
          Your role is read-only. Ask an owner or manager on your team to edit this product.
        </div>
      ) : (
        <EnterpriseProductForm action={saveEnterpriseProduct} product={product} />
      )}
    </div>
  );
}
