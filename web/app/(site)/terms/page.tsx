import type { Metadata } from 'next';
import { LegalDocumentView } from '@/components/LegalDocumentView';
import { getLegalDocument, documentTitle } from '@/lib/legal/content';
import { getLocale } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: documentTitle(locale, 'client', 'terms') };
}

export default async function TermsPage() {
  const locale = await getLocale();
  const document = getLegalDocument(locale, 'client', 'terms');

  return (
    <>
      <section className="page-hero">
        <div className="container narrow">
          <span className="eyebrow">{document.ui.audience}</span>
          <h1>{document.title}</h1>
          <p className="lede">
            {document.ui.lastUpdated}: {document.updated}
          </p>
        </div>
      </section>
      <LegalDocumentView document={document} locale={locale} />
    </>
  );
}
