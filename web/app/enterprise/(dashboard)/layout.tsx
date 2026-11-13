import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { DashShell, type NavGroup } from '@/components/DashShell';
import { requireEnterprise } from '@/lib/auth';
import { initials, titleCase } from '@/lib/format';
import { ENTERPRISE_SCRIPT } from '@/lib/tutorial';
import { getUserLocale } from '@/lib/i18n/server';
import { enterpriseCopy } from '@/lib/i18n/enterprise';
import { pick } from '@/lib/i18n';

export default async function EnterpriseDashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireEnterprise();
  const partner = ctx.partner;
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const chrome = pick(enterpriseCopy, locale).chrome;
  const t = pick(enterpriseCopy, locale).nav;

  // The menu follows the life cycle of a corporate code: set up, define the
  // reward, import the codes, then allocate and reconcile them.
  const nav: NavGroup[] = [
    {
      step: 1,
      label: t.group1,
      items: [
        { href: '/enterprise', label: t.overview, icon: 'dashboard', hint: t.overviewHint },
        { href: '/enterprise/settings', label: t.settings, icon: 'settings', hint: t.settingsHint },
      ],
    },
    {
      step: 2,
      label: t.group2,
      items: [
        { href: '/enterprise/products', label: t.products, icon: 'products', hint: t.productsHint },
        { href: '/enterprise/bulk-products', label: t.bulkProducts ?? 'Bulk products', icon: 'catalogue', hint: t.bulkProductsHint ?? 'Corporate pricing for business buyers.' },
      ],
    },
    {
      step: 3,
      label: t.group3,
      items: [{ href: '/enterprise/import', label: t.import, icon: 'import', hint: t.importHint }],
    },
    {
      step: 4,
      label: t.group4,
      items: [
        { href: '/enterprise/inventory', label: t.inventory, icon: 'inventory', hint: t.inventoryHint },
        { href: '/enterprise/reports', label: t.reports, icon: 'reports', hint: t.reportsHint },
      ],
    },
  ];

  return (
    <DashShell
      portalLabel={chrome.portal}
      workspaceName={partner.name}
      workspaceMeta={`${[partner.industry, partner.status].filter(Boolean).map((value) => titleCase(String(value), locale)).join(' · ') || chrome.qatar}`}
      userName={ctx.profile?.full_name ?? ctx.user.email ?? chrome.workspaceFallback}
      userEmail={ctx.user.email ?? ''}
      userInitials={initials(ctx.profile?.full_name ?? ctx.user.email ?? 'P')}
      accent="lavender"
      nav={nav}
      tutorial={ENTERPRISE_SCRIPT}
      locale={locale}
      autoOpenTutorial={!ctx.profile?.tutorial_completed_at}
      topRight={
        <>
          <span className="tag lavender dash-role">{titleCase(ctx.role, locale)}</span>
          <Link className="btn sm ghost" href="/corporate#enquiry" target="_blank">
            <ExternalLink size={14} /> {chrome.corporateSite}
          </Link>
          <Link className="btn sm primary" href="/enterprise/import">
            {chrome.importCodes}
          </Link>
        </>
      }
    >
      {children}
    </DashShell>
  );
}
