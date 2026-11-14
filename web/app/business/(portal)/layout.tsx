import Link from 'next/link';
import { ExternalLink, LifeBuoy } from 'lucide-react';
import { DashShell, type NavGroup } from '@/components/DashShell';
import { requireApprovedBusinessBuyer } from '@/lib/auth';
import { initials } from '@/lib/format';
import { businessCopy } from '@/lib/i18n/business';
import { BUSINESS_SCRIPT } from '@/lib/tutorial';
import { pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

export default async function BusinessPortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireApprovedBusinessBuyer();
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(businessCopy, locale);

  const nav: NavGroup[] = [
    {
      step: 1,
      label: t.nav.group1,
      items: [
        { href: '/business', label: t.nav.overview, icon: 'dashboard', hint: t.nav.overviewHint },
        { href: '/business/deals', label: t.nav.deals, icon: 'products', hint: t.nav.dealsHint },
      ],
    },
    {
      step: 2,
      label: t.nav.group2,
      items: [
        { href: '/business/orders', label: t.nav.orders, icon: 'orders', hint: t.nav.ordersHint },
      ],
    },
    {
      step: 3,
      label: t.nav.group3,
      items: [
        { href: '/', label: t.nav.publicSite, icon: 'catalogue', hint: t.nav.accountHint },
        { href: '/business/support', label: t.nav.support, icon: 'support', hint: t.nav.supportHint },
      ],
    },
  ];

  return (
    <DashShell
      portalLabel={t.chrome.portal}
      workspaceName={ctx.account.company_name}
      workspaceMeta={t.chrome.bulkPricing}
      userName={ctx.profile?.full_name ?? ctx.account.contact_name}
      userEmail={ctx.account.business_email}
      userInitials={initials(ctx.profile?.full_name ?? ctx.account.company_name)}
      accent="lavender"
      nav={nav}
      tutorial={BUSINESS_SCRIPT}
      locale={locale}
      autoOpenTutorial={false}
      topRight={
        <>
          <span className="tag lavender dash-role">{t.chrome.bulkPricing}</span>
          <Link className="btn sm ghost" href="/business/support">
            <LifeBuoy size={15} /> {t.nav.support}
          </Link>
          <Link className="btn sm ghost" href="/" target="_blank">
            <ExternalLink size={14} /> {t.nav.publicSite}
          </Link>
          <Link className="btn sm primary" href="/business/deals">
            <LifeBuoy size={14} /> {t.nav.deals}
          </Link>
        </>
      }
    >
      {children}
    </DashShell>
  );
}
