import { requireVendor } from '@/lib/auth';
import { SupportPage } from '@/components/SupportPage';

export default async function VendorSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireVendor();

  return (
    <SupportPage
      audience="vendor"
      returnTo="/vendor/support"
      supabase={ctx.supabase}
      userId={ctx.user.id}
      preferredLanguage={ctx.profile?.preferred_language}
      sent={params.sent}
      error={params.error}
    />
  );
}
