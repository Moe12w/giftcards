import type { Metadata } from 'next';
import { VendorDirectory } from '@/components/VendorDirectory';
import { getCachedBusinessDirectory } from '@/lib/public-cache';
import { site } from '@/lib/i18n/site';
import { common } from '@/lib/i18n/common';
import { pick } from '@/lib/i18n';
import { getPublicLocale } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getPublicLocale();
  return { title: pick(site, locale).vendors.pageTitle };
}

export default async function VendorsPage() {
  const locale = await getPublicLocale();
  const t = pick(site, locale).vendors;
  const c = pick(common, locale);
  const rows = await getCachedBusinessDirectory();

  // Search/filtering happens in the client component so this page prerenders.
  return <VendorDirectory rows={rows} t={t} searchLabel={c.actions.search} />;
}
