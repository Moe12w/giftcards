import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { createProduct } from '@/lib/actions/vendor';
import { ProductForm } from '@/components/ProductForm';
import { PageHead } from '@/components/ui';
import { pick } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';
import { vendorCopy } from '@/lib/i18n/vendor';

export default async function NewVendorProductPage() {
  const ctx = await requireVendor();
  const locale = await getLocale();
  const t = pick(vendorCopy, locale).productNew;
  const { data: categories } = await ctx.supabase
    .from('categories')
    .select('id, name')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  return (
    <div className="dash-content">
      <Link className="back-link" href="/vendor/products">
        <ArrowLeft size={15} /> {t.backToGifts}
      </Link>
      <PageHead
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
      />
      <ProductForm
        action={createProduct}
        categories={(categories ?? []) as { id: string; name: string }[]}
        mode="create"
      />
    </div>
  );
}
