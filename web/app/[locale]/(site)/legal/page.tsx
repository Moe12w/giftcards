import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, FileText, ShieldCheck } from 'lucide-react';
import {
  audienceLabel,
  audienceShort,
  getLegalBundle,
  legalPath,
  LEGAL_AUDIENCES,
} from '@/lib/legal/content';
import { getPublicLocale } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getPublicLocale();
  const t = getLegalBundle(locale).ui;
  return {
    title: t.legalCentre,
    description: t.legalCentreLede,
  };
}

export default async function LegalCentrePage() {
  const locale = await getPublicLocale();
  const bundle = getLegalBundle(locale);
  const t = bundle.ui;
  const isArabic = locale === 'ar';

  return (
    <>
      <section className="page-hero">
        <div className="container narrow">
          <span className="eyebrow">{isArabic ? 'قانوني' : 'Legal'}</span>
          <h1>{t.legalCentre}</h1>
          <p className="lede">{t.legalCentreLede}</p>
          <p className="small muted" style={{ marginTop: 10 }}>
            {t.lastUpdated}: {bundle.updated} · {t.version} · {bundle.company.legalName} ·{' '}
            {isArabic ? 'السجل التجاري' : 'CR'} {bundle.company.cr}
          </p>
        </div>
      </section>

      <section className="container section tight">
        <div className="legal-hub-grid">
          {LEGAL_AUDIENCES.map((audience) => (
            <article className="card legal-hub-card" key={audience}>
              <span className="eyebrow">{`${t.terms} · ${t.privacy}`}</span>
              <h2>{audienceLabel(locale, audience)}</h2>
              <p className="small">{audienceShort(locale, audience)}</p>
              <div className="legal-hub-links">
                <Link className="btn sm" href={legalPath(audience, 'terms')}>
                  <FileText size={15} /> {t.terms}
                </Link>
                <Link className="btn sm ghost" href={legalPath(audience, 'privacy')}>
                  <ShieldCheck size={15} /> {t.privacy}
                </Link>
              </div>
            </article>
          ))}
        </div>

        <div className="card mint legal-hub-note">
          <h2 style={{ marginTop: 0 }}>{isArabic ? 'كيف تقرأ هذه الوثائق' : 'How to read these documents'}</h2>
          <p>
            {isArabic
              ? 'لكل دور شروطه وسياسة خصوصية خاصة به. تنطبق الشروط العامة على الجميع، ويضيف الملحق الخاص بدورك الأحكام التي تنطبق على طريقة تعاملك مع المنصة. وإذا كنت تستخدم Giftly بأكثر من صفة، فقد تنطبق عليك أكثر من وثيقة.'
              : 'Each role has its own terms and privacy notice. The general sections apply to everyone, and your role schedule adds the provisions that match the way you use the Platform. If you use Giftly in more than one capacity, more than one document may apply to you.'}
          </p>
          <p className="small muted">
            {isArabic
              ? 'هذه الوثائق محكومة بقوانين دولة قطر. وهي ليست بديلاً عن المشورة القانونية المتخصصة في حالة معينة.'
              : 'These documents are governed by the laws of the State of Qatar. They are not a substitute for legal advice on a specific situation.'}
          </p>
          <div className="btn-row">
            <Link className="btn primary" href={legalPath('client', 'terms')}>
              {t.readTerms} <ArrowRight size={16} />
            </Link>
            <Link className="btn" href="/contact">
              {t.contactLegal}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
