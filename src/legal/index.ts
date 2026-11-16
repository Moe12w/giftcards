// src/legal/index.ts
// The legal documents live as plain JSON so the same text can be rendered by
// the Expo app and the web dashboards. This module only composes a document;
// it deliberately contains no copy of the legal text itself.
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

export type LegalBundle = typeof en;

export interface LegalDocument {
  audience: LegalAudience;
  doc: LegalDoc;
  title: string;
  intro: string[];
  sections: LegalSection[];
  updated: string;
  company: LegalBundle['company'];
  ui: LegalBundle['ui'];
}

export const LEGAL_AUDIENCES: LegalAudience[] = ['client', 'vendor', 'enterprise', 'bulk'];
export const LEGAL_DOCS: LegalDoc[] = ['terms', 'privacy'];

const bundles: Record<LegalLocale, LegalBundle> = { en, ar };

export function getLegalBundle(locale: LegalLocale): LegalBundle {
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
  const entry = getLegalBundle(locale).audiences[audience];
  return doc === 'terms' ? entry.termsTitle : entry.privacyTitle;
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

export function isLegalAudience(value: string | string[] | undefined): value is LegalAudience {
  return typeof value === 'string' && (LEGAL_AUDIENCES as string[]).includes(value);
}

export function isLegalDoc(value: string | string[] | undefined): value is LegalDoc {
  return typeof value === 'string' && (LEGAL_DOCS as string[]).includes(value);
}
