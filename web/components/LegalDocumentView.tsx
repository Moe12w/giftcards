import Link from 'next/link';
import type { LegalDocument, LegalLocale } from '@/lib/legal/content';
import { audienceLabel, legalPath, LEGAL_AUDIENCES } from '@/lib/legal/content';

export function LegalDocumentView({
  document,
  locale,
}: {
  document: LegalDocument;
  locale: LegalLocale;
}) {
  const t = document.ui;
  const isArabic = locale === 'ar';

  return (
    <section className="container legal-layout section tight">
      <aside className="legal-toc" aria-label={t.onThisPage}>
        <span className="eyebrow">{t.onThisPage}</span>
        <ol>
          {document.sections.map((section, index) => (
            <li key={`${section.h}-${index}`}>
              <a href={`#s-${index}`}>{section.h}</a>
            </li>
          ))}
        </ol>
        <div className="legal-switch">
          <span className="small muted">{t.audience}</span>
          {LEGAL_AUDIENCES.map((audience) => (
            <Link
              key={audience}
              href={legalPath(audience, document.doc)}
              className={audience === document.audience ? 'active' : ''}
            >
              {audienceLabel(locale, audience)}
            </Link>
          ))}
        </div>
      </aside>

      <article className="legal-body legal-copy">
        <div className="legal-meta">
          <span className="tag">{document.title}</span>
          <span>
            {t.lastUpdated}: {document.updated} · {t.version}
          </span>
        </div>

        {document.intro.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}

        {document.sections.map((section, index) => (
          <section id={`s-${index}`} key={`${section.h}-${index}`}>
            <h2>{section.h}</h2>
            {section.p.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.b?.length ? (
              <ul>
                {section.b.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}

        <div className="card legal-contact">
          <h2 style={{ marginTop: 0 }}>{isArabic ? 'التواصل معنا' : 'Contact us'}</h2>
          <p>
            {document.company.legalName} · {isArabic ? 'السجل التجاري' : 'CR'}{' '}
            {document.company.cr} · {document.company.address}
          </p>
          <p>
            {isArabic ? 'قانوني' : 'Legal'}:{' '}
            <a href={`mailto:${document.company.legalEmail}`}>{document.company.legalEmail}</a>
            {' · '}
            {isArabic ? 'الخصوصية' : 'Privacy'}:{' '}
            <a href={`mailto:${document.company.privacyEmail}`}>{document.company.privacyEmail}</a>
            {' · '}
            {isArabic ? 'الدعم' : 'Support'}:{' '}
            <a href={`mailto:${document.company.supportEmail}`}>{document.company.supportEmail}</a>
          </p>
          <div className="btn-row" style={{ marginTop: 14 }}>
            <Link className="btn sm" href="/legal">
              {t.backToLegal}
            </Link>
            <Link className="btn sm" href="/contact">
              {isArabic ? 'نموذج التواصل' : 'Contact form'}
            </Link>
          </div>
        </div>
      </article>
    </section>
  );
}
