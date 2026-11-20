import { AdvertisingOverview } from '@/components/advertising/AdvertisingOverview';

export default async function VendorAdvertisingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; paused?: string; resumed?: string }>;
}) {
  return <AdvertisingOverview prefer="vendor" searchParams={searchParams} />;
}
