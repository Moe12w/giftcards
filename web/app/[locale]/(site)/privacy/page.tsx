import type { Metadata } from 'next';
import { LegalDocumentView } from '@/components/LegalDocumentView';
import { getLegalDocument, documentTitle } from '@/lib/legal/content';
import { getPublicLocale } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getPublicLocale();
  return { title: documentTitle(locale, 'client', 'privacy') };
}

export default async function PrivacyPage() {
  const locale = await getPublicLocale();
  const document = getLegalDocument(locale, 'client', 'privacy');

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
