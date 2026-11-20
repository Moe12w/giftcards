import { AdvertisingOverview } from '@/components/advertising/AdvertisingOverview';

export default async function EnterpriseAdvertisingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; paused?: string; resumed?: string }>;
}) {
  return <AdvertisingOverview prefer="enterprise" searchParams={searchParams} />;
}
