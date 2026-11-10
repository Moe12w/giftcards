// src/lib/time.ts
// Small date helpers shared by demo data and screens.

export function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

export function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-QA' : 'en-QA');
}

/** Compact relative timestamp used by the basket activity feed. */
export function timeAgo(iso: string, locale: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.floor(diff / 60_000));
  if (minutes < 1) return locale === 'ar' ? 'الآن' : 'just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return formatDate(iso, locale);
}
