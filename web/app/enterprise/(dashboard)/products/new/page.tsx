import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireEnterprise } from '@/lib/auth';
import { saveEnterpriseProduct } from '@/lib/actions/enterprise';
import { EnterpriseProductForm } from '@/components/EnterpriseProductForm';
import { PageHead } from '@/components/ui';

export default async function NewEnterpriseProductPage() {
  const ctx = await requireEnterprise();

  return (
    <div className="dash-content">
      <Link className="back-link" href="/enterprise/products">
        <ArrowLeft size={15} /> Back to products
      </Link>
      <PageHead
        eyebrow="New product"
        title="Define a reward."
        description="Set the face value, your selling price and the commission. Codes imported against this product inherit its denomination."
      />
      {ctx.role === 'analyst' ? (
        <div className="callout warn">
          Your role is read-only. Ask an owner or manager on your team to create products.
        </div>
      ) : (
        <EnterpriseProductForm action={saveEnterpriseProduct} />
      )}
    </div>
  );
}
