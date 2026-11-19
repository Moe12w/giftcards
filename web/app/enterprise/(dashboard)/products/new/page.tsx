import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireEnterprise } from '@/lib/auth';
import { saveEnterpriseProduct } from '@/lib/actions/enterprise';
import { EnterpriseProductForm } from '@/components/EnterpriseProductForm';
import { PageHead } from '@/components/ui';
import { pick } from '@/lib/i18n';
import { enterpriseCopy } from '@/lib/i18n/enterprise';
import { getLocale } from '@/lib/i18n/server';

export default async function NewEnterpriseProductPage() {
  const locale = await getLocale();
  const t = pick(enterpriseCopy, locale).productNew;
  const ctx = await requireEnterprise();

  return (
    <div className="dash-content">
      <Link className="back-link" href="/enterprise/products">
        <ArrowLeft size={15} /> {t.backToProducts}
      </Link>
      <PageHead
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
      />
      {ctx.role === 'analyst' ? (
        <div className="callout warn">
          {t.readOnly}
        </div>
      ) : (
        <EnterpriseProductForm action={saveEnterpriseProduct} />
      )}
    </div>
  );
}
