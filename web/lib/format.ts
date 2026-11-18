import type { Locale } from '@/lib/i18n';
import { labelFor } from '@/lib/i18n/labels';

/** Arabic uses Arabic-Indic digits and its own month names. */
function dateLocale(locale: Locale): string {
  return locale === 'ar' ? 'ar-QA' : 'en-QA';
}

export function formatDate(
  value: string | Date | null | undefined,
  locale: Locale = 'en',
): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(dateLocale(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Qatar',
    numberingSystem: 'latn',
  }).format(date);
}

export function formatDateTime(
  value: string | Date | null | undefined,
  locale: Locale = 'en',
): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(dateLocale(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Qatar',
    numberingSystem: 'latn',
  }).format(date);
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '?')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}

/** Turns a stored value into a readable name, in the given language. */
export function titleCase(value: string, locale: Locale = 'en'): string {
  return labelFor(value, locale);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

