import { EditCampaign } from '@/components/advertising/EditCampaign';

export default async function EditAdvertisingCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <EditCampaign prefer="enterprise" params={params} />;
}
