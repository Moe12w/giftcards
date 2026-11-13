import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { DashShell, type NavGroup } from '@/components/DashShell';
import { requireAdmin } from '@/lib/auth';
import { initials } from '@/lib/format';
import { ADMIN_SCRIPT } from '@/lib/tutorial';
import { getUserLocale } from '@/lib/i18n/server';
import { adminCopy } from '@/lib/i18n/admin';
import { pick } from '@/lib/i18n';

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAdmin();
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const chrome = pick(adminCopy, locale).chrome;
  const t = pick(adminCopy, locale).nav;

  // The menu follows the life cycle: who is allowed to sell, what is live,
  // what moved, and who needs help.
  const nav: NavGroup[] = [
    {
      step: 1,
      label: t.group1,
      items: [
        { href: '/admin', label: t.overview, icon: 'dashboard', hint: t.overviewHint },
        { href: '/admin/vendors', label: t.vendors, icon: 'vendors', hint: t.vendorsHint },
      ],
    },
    {
      step: 2,
      label: t.group2,
      items: [
        { href: '/admin/products', label: t.products, icon: 'products', hint: t.productsHint },
        { href: '/admin/bulk-products', label: t.bulkProducts ?? 'Bulk products', icon: 'catalogue', hint: t.bulkProductsHint ?? 'Bulk offers sold to business buyers.' },
        { href: '/admin/promotions', label: t.promotions, icon: 'promotions', hint: t.promotionsHint },
      ],
    },
    {
      step: 3,
      label: t.group3,
      items: [
        { href: '/admin/orders', label: t.orders, icon: 'orders', hint: t.ordersHint },
        { href: '/admin/bulk-orders', label: t.bulkOrders ?? 'Bulk orders', icon: 'finance', hint: t.bulkOrdersHint ?? 'Corporate orders and gift card issuance.' },
        { href: '/admin/vouchers', label: t.vouchers, icon: 'vouchers', hint: t.vouchersHint },
      ],
    },
    {
      step: 4,
      label: t.group4,
      items: [
        { href: '/admin/customers', label: t.customers, icon: 'customers', hint: t.customersHint },
        { href: '/admin/business-accounts', label: t.businessAccounts ?? 'Business accounts', icon: 'customers', hint: t.businessAccountsHint ?? 'Bulk buyer registrations and approvals.' },
        { href: '/admin/enterprise', label: t.enterprise, icon: 'enterprise', hint: t.enterpriseHint },
      ],
    },
    {
      step: 5,
      label: t.group5,
      items: [
        { href: '/admin/support', label: t.support, icon: 'support', hint: t.supportHint },
        { href: '/admin/audit', label: t.audit, icon: 'audit', hint: t.auditHint },
        { href: '/admin/settings', label: t.settings, icon: 'settings', hint: t.settingsHint },
      ],
    },
  ];

  return (
    <DashShell
      portalLabel={chrome.portal}
      workspaceName={chrome.workspace}
      workspaceMeta={chrome.workspaceMeta}
      userName={ctx.profile?.full_name ?? ctx.user.email ?? 'Admin'}
      userEmail={ctx.user.email ?? ''}
      userInitials={initials(ctx.profile?.full_name ?? ctx.user.email ?? 'A')}
      accent="coral"
      nav={nav}
      tutorial={ADMIN_SCRIPT}
      locale={locale}
      autoOpenTutorial={!ctx.profile?.tutorial_completed_at}
      topRight={
        <>
          <span className="tag coral dash-role">{chrome.admin}</span>
          <Link className="btn sm ghost" href="/" target="_blank">
            <ExternalLink size={14} /> {chrome.publicSite}
          </Link>
        </>
      }
    >
      {children}
    </DashShell>
  );
}
