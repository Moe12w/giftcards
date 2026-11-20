import { CampaignDetail } from '@/components/advertising/CampaignDetail';

export default async function VendorAdvertisingCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; paused?: string; resumed?: string; paid?: string; error?: string }>;
}) {
  return <CampaignDetail prefer="vendor" params={params} searchParams={searchParams} />;
}
