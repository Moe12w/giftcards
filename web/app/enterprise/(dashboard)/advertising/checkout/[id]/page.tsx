import { Checkout } from '@/components/advertising/Checkout';

export default async function AdvertisingCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  return <Checkout prefer="enterprise" params={params} searchParams={searchParams} />;
}
