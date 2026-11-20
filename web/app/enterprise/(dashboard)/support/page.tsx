import { requireEnterprise } from '@/lib/auth';
import { SupportPage } from '@/components/SupportPage';

export default async function EnterpriseSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireEnterprise();

  return (
    <SupportPage
      audience="enterprise"
      returnTo="/enterprise/support"
      supabase={ctx.supabase}
      userId={ctx.user.id}
      preferredLanguage={ctx.profile?.preferred_language}
      sent={params.sent}
      error={params.error}
    />
  );
}
