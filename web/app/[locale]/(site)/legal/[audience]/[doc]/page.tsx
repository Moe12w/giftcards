import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalDocumentView } from '@/components/LegalDocumentView';
import {
  documentTitle,
  getLegalDocument,
  isLegalAudience,
  isLegalDoc,
  LEGAL_AUDIENCES,
  LEGAL_DOCS,
} from '@/lib/legal/content';
import { getPublicLocale } from '@/lib/i18n/server';

type PageProps = { params: Promise<{ audience: string; doc: string }> };

export function generateStaticParams() {
  return LEGAL_AUDIENCES.flatMap((audience) =>
    LEGAL_DOCS.map((doc) => ({ audience, doc })),
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { audience, doc } = await params;
  if (!isLegalAudience(audience) || !isLegalDoc(doc)) return {};
  const locale = await getPublicLocale();
  return { title: documentTitle(locale, audience, doc) };
}

export default async function LegalDocumentPage({ params }: PageProps) {
  const { audience, doc } = await params;
  if (!isLegalAudience(audience) || !isLegalDoc(doc)) notFound();

  const locale = await getPublicLocale();
  const document = getLegalDocument(locale, audience, doc);

  return (
    <>
      <section className="page-hero">
        <div className="container narrow">
          <span className="eyebrow">{document.ui.audience}</span>
          <h1>{document.title}</h1>
          <p className="lede">{document.ui.lastUpdated}: {document.updated}</p>
        </div>
      </section>
      <LegalDocumentView document={document} locale={locale} />
    </>
  );
}
