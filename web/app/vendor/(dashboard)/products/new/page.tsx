import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { createProduct } from '@/lib/actions/vendor';
import { ProductForm } from '@/components/ProductForm';
import { PageHead } from '@/components/ui';

export default async function NewVendorProductPage() {
  const ctx = await requireVendor();
  const { data: categories } = await ctx.supabase
    .from('categories')
    .select('id, name')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  return (
    <div className="dash-content">
      <Link className="back-link" href="/vendor/products">
        <ArrowLeft size={15} /> Back to gifts
      </Link>
      <PageHead
        eyebrow="New gift"
        title="Create something worth giving."
        description="Start with the basics. For an experience, add packages with a label, session count and price. For a gift card, set the amount range."
      />
      <ProductForm
        action={createProduct}
        categories={(categories ?? []) as { id: string; name: string }[]}
        mode="create"
      />
    </div>
  );
}
