import en from './en.json';
import ar from './ar.json';

export type LegalLocale = 'en' | 'ar';
export type LegalAudience = 'client' | 'vendor' | 'enterprise' | 'bulk';
export type LegalDoc = 'terms' | 'privacy';

export interface LegalSection {
  h: string;
  p: string[];
  b?: string[];
}

export interface LegalDocument {
  audience: LegalAudience;
  doc: LegalDoc;
  title: string;
  intro: string[];
  sections: LegalSection[];
  updated: string;
  company: typeof en.company;
  ui: typeof en.ui;
}

export const LEGAL_AUDIENCES: LegalAudience[] = ['client', 'vendor', 'enterprise', 'bulk'];
export const LEGAL_DOCS: LegalDoc[] = ['terms', 'privacy'];

const bundles = { en, ar };

export function getLegalBundle(locale: LegalLocale) {
  return bundles[locale] ?? bundles.en;
}

export function audienceLabel(locale: LegalLocale, audience: LegalAudience): string {
  return getLegalBundle(locale).audiences[audience].label;
}

export function audienceShort(locale: LegalLocale, audience: LegalAudience): string {
  return getLegalBundle(locale).audiences[audience].short;
}

export function documentTitle(
  locale: LegalLocale,
  audience: LegalAudience,
  doc: LegalDoc,
): string {
  const a = getLegalBundle(locale).audiences[audience];
  return doc === 'terms' ? a.termsTitle : a.privacyTitle;
}

export function getLegalDocument(
  locale: LegalLocale,
  audience: LegalAudience,
  doc: LegalDoc,
): LegalDocument {
  const bundle = getLegalBundle(locale);
  const common = bundle.common[doc];
  const specific = bundle.audienceSections[audience][doc] as LegalSection[];
  const opening = common.opening as LegalSection[];
  const closing = common.closing as LegalSection[];

  return {
    audience,
    doc,
    title: documentTitle(locale, audience, doc),
    intro: common.intro,
    sections: [...opening, ...specific, ...closing],
    updated: bundle.updated,
    company: bundle.company,
    ui: bundle.ui,
  };
}

export function legalPath(audience: LegalAudience, doc: LegalDoc): string {
  return `/legal/${audience}/${doc}`;
}

export function isLegalAudience(value: string): value is LegalAudience {
  return (LEGAL_AUDIENCES as string[]).includes(value);
}

export function isLegalDoc(value: string): value is LegalDoc {
  return (LEGAL_DOCS as string[]).includes(value);
}
